import json
import os
import psycopg2
import hashlib
import hmac
import base64
from datetime import datetime

SECRET_KEY = os.environ.get('JWT_SECRET', 'public-eye-secret-2024')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
}

SHELTER_TYPES = {
    'metro': {'label': 'Метро', 'icon': '🚇', 'color': '#3B82F6'},
    'basement': {'label': 'Подвал', 'icon': '🏚️', 'color': '#6B7280'},
    'bunker': {'label': 'Бункер', 'icon': '🛡️', 'color': '#1D4ED8'},
    'shelter': {'label': 'Укрытие', 'icon': '⛺', 'color': '#10B981'},
    'parking': {'label': 'Паркинг', 'icon': '🅿️', 'color': '#F59E0B'},
    'hospital': {'label': 'Больница', 'icon': '🏥', 'color': '#EF4444'},
    'school': {'label': 'Школа/ДК', 'icon': '🏫', 'color': '#8B5CF6'},
    'other': {'label': 'Другое', 'icon': '📍', 'color': '#94A3B8'},
}

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

def get_user(event):
    auth = event.get('headers', {}).get('X-Authorization', '')
    token = auth.replace('Bearer ', '') if auth else ''
    return verify_jwt(token) if token else None

def row_to_shelter(row):
    t = row[3]
    type_info = SHELTER_TYPES.get(t, SHELTER_TYPES['other'])
    return {
        'id': row[0], 'user_id': row[1], 'title': row[2],
        'type': t, 'type_label': type_info['label'],
        'type_icon': type_info['icon'], 'type_color': type_info['color'],
        'description': row[4], 'address': row[5],
        'lat': float(row[6]), 'lng': float(row[7]),
        'capacity': row[8], 'status': row[9],
        'verified': row[10], 'created_at': str(row[11]),
        'author_name': row[12],
    }

def handler(event: dict, context) -> dict:
    """Убежища и укрытия: список, добавление, удаление"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    shelter_id = int(params['id']) if params.get('id', '').isdigit() else None

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    user = get_user(event)
    conn = get_db()
    cur = conn.cursor()

    # GET — список всех убежищ
    if method == 'GET' and not shelter_id:
        cur.execute("""
            SELECT s.id, s.user_id, s.title, s.type, s.description, s.address,
                   s.lat, s.lng, s.capacity, s.status, s.verified, s.created_at,
                   u.name as author_name
            FROM shelters s LEFT JOIN users u ON s.user_id = u.id
            WHERE s.status = 'active'
            ORDER BY s.verified DESC, s.created_at DESC
        """)
        rows = cur.fetchall()
        conn.close()
        return {
            'statusCode': 200, 'headers': CORS_HEADERS,
            'body': json.dumps({
                'shelters': [row_to_shelter(r) for r in rows],
                'types': SHELTER_TYPES,
                'total': len(rows)
            })
        }

    # POST — добавить убежище (без авторизации в демо-режиме)
    if method == 'POST':
        title = body.get('title', '').strip()
        lat = body.get('lat')
        lng = body.get('lng')
        shelter_type = body.get('type', 'shelter')

        if not title or lat is None or lng is None:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Укажите название и место на карте'})}
        if shelter_type not in SHELTER_TYPES:
            shelter_type = 'other'

        author_id = user['user_id'] if user else None
        cur.execute("""
            INSERT INTO shelters (user_id, title, type, description, address, lat, lng, capacity)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            author_id, title, shelter_type,
            body.get('description', '').strip() or None,
            body.get('address', '').strip() or None,
            lat, lng,
            int(body['capacity']) if body.get('capacity') else None
        ))
        new_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': json.dumps({'id': new_id, 'message': 'Убежище добавлено'})}

    # DELETE ?id=X
    if method == 'DELETE' and shelter_id:
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}
        cur.execute("UPDATE shelters SET status = 'deleted' WHERE id = %s", (shelter_id,))
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'message': 'Удалено'})}

    conn.close()
    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}
