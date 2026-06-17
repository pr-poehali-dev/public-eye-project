import json
import os
import hashlib
import hmac
import base64
import psycopg2
from datetime import datetime

SECRET_KEY = os.environ.get('JWT_SECRET', 'public-eye-secret-2024')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id, X-Authorization',
}

VALID_CATEGORIES = ['roads', 'garbage', 'utilities', 'traffic_lights', 'signs', 'lighting', 'landscaping', 'other']
VALID_STATUSES = ['new', 'in_progress', 'resolved', 'rejected']

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def verify_jwt(token: str):
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected = base64.urlsafe_b64encode(
            hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
        ).rstrip(b'=').decode()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + '=='))
        if payload.get('exp', 0) < datetime.utcnow().timestamp():
            return None
        return payload
    except Exception:
        return None

def get_user_from_event(event):
    auth = event.get('headers', {}).get('X-Authorization', '')
    token = auth.replace('Bearer ', '') if auth else ''
    return verify_jwt(token) if token else None

def row_to_complaint(row):
    return {
        'id': row[0], 'user_id': row[1], 'title': row[2], 'description': row[3],
        'category': row[4], 'status': row[5], 'address': row[6],
        'lat': float(row[7]) if row[7] else None, 'lng': float(row[8]) if row[8] else None,
        'contact_info': row[9], 'official_comment': row[10], 'supports_count': row[11],
        'is_spam': row[12], 'created_at': str(row[13]), 'updated_at': str(row[14]),
        'author_name': row[15], 'photos': []
    }

def handler(event: dict, context) -> dict:
    """CRUD для жалоб: создание, просмотр, поддержка, комментарии, смена статуса"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    user = get_user_from_event(event)
    conn = get_db()
    cur = conn.cursor()

    # GET /complaints — список жалоб с фильтрами
    if method == 'GET' and not any(x in path for x in ['/support', '/comments']):
        parts = path.rstrip('/').split('/')
        if parts[-1].isdigit():
            complaint_id = int(parts[-1])
            cur.execute("""
                SELECT c.id, c.user_id, c.title, c.description, c.category, c.status,
                       c.address, c.lat, c.lng, c.contact_info, c.official_comment,
                       c.supports_count, c.is_spam, c.created_at, c.updated_at,
                       u.name as author_name
                FROM complaints c LEFT JOIN users u ON c.user_id = u.id
                WHERE c.id = %s AND c.is_spam = FALSE
            """, (complaint_id,))
            row = cur.fetchone()
            if not row:
                conn.close()
                return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Жалоба не найдена'})}
            complaint = row_to_complaint(row)
            cur.execute("SELECT photo_url FROM complaint_photos WHERE complaint_id = %s", (complaint_id,))
            complaint['photos'] = [r[0] for r in cur.fetchall()]
            cur.execute("""
                SELECT cm.id, cm.text, cm.is_official, cm.created_at, u.name
                FROM comments cm LEFT JOIN users u ON cm.user_id = u.id
                WHERE cm.complaint_id = %s ORDER BY cm.created_at ASC
            """, (complaint_id,))
            complaint['comments'] = [
                {'id': r[0], 'text': r[1], 'is_official': r[2], 'created_at': str(r[3]), 'author_name': r[4]}
                for r in cur.fetchall()
            ]
            # Проверяем поддержал ли текущий пользователь
            if user:
                cur.execute("SELECT id FROM complaint_supports WHERE complaint_id = %s AND user_id = %s", (complaint_id, user['user_id']))
                complaint['user_supported'] = cur.fetchone() is not None
            else:
                complaint['user_supported'] = False
            conn.close()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(complaint)}

        # Список жалоб
        params = event.get('queryStringParameters') or {}
        category = params.get('category')
        status = params.get('status')
        limit = min(int(params.get('limit', 50)), 100)
        offset = int(params.get('offset', 0))
        user_id_filter = params.get('user_id')

        conditions = ["c.is_spam = FALSE"]
        args = []
        if category and category in VALID_CATEGORIES:
            conditions.append("c.category = %s")
            args.append(category)
        if status and status in VALID_STATUSES:
            conditions.append("c.status = %s")
            args.append(status)
        if user_id_filter:
            conditions.append("c.user_id = %s")
            args.append(int(user_id_filter))

        where = " AND ".join(conditions)
        cur.execute(f"""
            SELECT c.id, c.user_id, c.title, c.description, c.category, c.status,
                   c.address, c.lat, c.lng, c.contact_info, c.official_comment,
                   c.supports_count, c.is_spam, c.created_at, c.updated_at,
                   u.name as author_name
            FROM complaints c LEFT JOIN users u ON c.user_id = u.id
            WHERE {where}
            ORDER BY c.created_at DESC LIMIT %s OFFSET %s
        """, args + [limit, offset])
        rows = cur.fetchall()
        complaints = []
        for row in rows:
            c = row_to_complaint(row)
            cur.execute("SELECT photo_url FROM complaint_photos WHERE complaint_id = %s LIMIT 1", (c['id'],))
            ph = cur.fetchone()
            c['photos'] = [ph[0]] if ph else []
            complaints.append(c)

        cur.execute(f"SELECT COUNT(*) FROM complaints c WHERE {where}", args)
        total = cur.fetchone()[0]
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'complaints': complaints, 'total': total})}

    # POST /complaints — создание жалобы (DEMO: авторизация не требуется)
    if method == 'POST' and path.endswith('/complaints'):
        title = body.get('title', '').strip()
        description = body.get('description', '').strip()
        category = body.get('category', '')
        if not title or not description or category not in VALID_CATEGORIES:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Заполните обязательные поля'})}
        author_id = user['user_id'] if user else None
        lat = body.get('lat')
        lng = body.get('lng')
        address = body.get('address', '').strip()
        contact_info = body.get('contact_info', '').strip()
        cur.execute("""
            INSERT INTO complaints (user_id, title, description, category, address, lat, lng, contact_info)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (author_id, title, description, category, address or None, lat, lng, contact_info or None))
        complaint_id = cur.fetchone()[0]
        # Сохраняем фото (URL из S3)
        photos = body.get('photos', [])
        for photo_url in photos[:5]:
            cur.execute("INSERT INTO complaint_photos (complaint_id, photo_url) VALUES (%s, %s)", (complaint_id, photo_url))
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': json.dumps({'id': complaint_id, 'message': 'Жалоба создана'})}

    # PATCH /complaints/:id/status — смена статуса (модератор/админ)
    if method == 'PATCH' and '/status' in path:
        if not user or user.get('role') not in ('moderator', 'admin'):
            conn.close()
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет прав'})}
        parts = path.rstrip('/').split('/')
        idx = parts.index('complaints') + 1 if 'complaints' in parts else -1
        complaint_id = int(parts[idx]) if idx > 0 and parts[idx].isdigit() else None
        if not complaint_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не указан ID жалобы'})}
        new_status = body.get('status')
        official_comment = body.get('official_comment')
        is_spam = body.get('is_spam')
        if new_status and new_status not in VALID_STATUSES:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Неверный статус'})}
        updates = ["updated_at = NOW()"]
        args = []
        if new_status:
            updates.append("status = %s")
            args.append(new_status)
        if official_comment is not None:
            updates.append("official_comment = %s")
            args.append(official_comment)
        if is_spam is not None:
            updates.append("is_spam = %s")
            args.append(bool(is_spam))
        args.append(complaint_id)
        cur.execute(f"UPDATE complaints SET {', '.join(updates)} WHERE id = %s", args)
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'message': 'Обновлено'})}

    # POST /complaints/:id/support
    if method == 'POST' and '/support' in path:
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}
        parts = path.rstrip('/').split('/')
        idx = parts.index('complaints') + 1 if 'complaints' in parts else -1
        complaint_id = int(parts[idx]) if idx > 0 and parts[idx].isdigit() else None
        if not complaint_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не указан ID жалобы'})}
        cur.execute("SELECT id FROM complaint_supports WHERE complaint_id = %s AND user_id = %s", (complaint_id, user['user_id']))
        existing = cur.fetchone()
        if existing:
            cur.execute("DELETE FROM complaint_supports WHERE complaint_id = %s AND user_id = %s", (complaint_id, user['user_id']))
            cur.execute("UPDATE complaints SET supports_count = GREATEST(0, supports_count - 1) WHERE id = %s", (complaint_id,))
            conn.commit()
            cur.execute("SELECT supports_count FROM complaints WHERE id = %s", (complaint_id,))
            count = cur.fetchone()[0]
            conn.close()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'supported': False, 'supports_count': count})}
        cur.execute("INSERT INTO complaint_supports (complaint_id, user_id) VALUES (%s, %s)", (complaint_id, user['user_id']))
        cur.execute("UPDATE complaints SET supports_count = supports_count + 1 WHERE id = %s", (complaint_id,))
        conn.commit()
        cur.execute("SELECT supports_count FROM complaints WHERE id = %s", (complaint_id,))
        count = cur.fetchone()[0]
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'supported': True, 'supports_count': count})}

    # POST /complaints/:id/comments
    if method == 'POST' and '/comments' in path:
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}
        parts = path.rstrip('/').split('/')
        idx = parts.index('complaints') + 1 if 'complaints' in parts else -1
        complaint_id = int(parts[idx]) if idx > 0 and parts[idx].isdigit() else None
        text = body.get('text', '').strip()
        if not complaint_id or not text:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не указан текст комментария'})}
        is_official = user.get('role') in ('moderator', 'admin') and body.get('is_official', False)
        cur.execute("""
            INSERT INTO comments (complaint_id, user_id, text, is_official) VALUES (%s, %s, %s, %s)
            RETURNING id, created_at
        """, (complaint_id, user['user_id'], text, is_official))
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': json.dumps({'id': row[0], 'created_at': str(row[1])})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}