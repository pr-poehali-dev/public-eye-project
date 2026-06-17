import json
import os
import hashlib
import hmac
import base64
import re
import psycopg2
from datetime import datetime, timedelta

SECRET_KEY = os.environ.get('JWT_SECRET', 'public-eye-secret-2024')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id, X-Authorization',
}

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def make_jwt(payload: dict) -> str:
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64url(json.dumps(payload).encode())
    sig = b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def verify_jwt(token: str):
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected = b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + '=='))
        if payload.get('exp', 0) < datetime.utcnow().timestamp():
            return None
        return payload
    except Exception:
        return None

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return base64.b64encode(salt + dk).decode()

def check_password(password: str, stored: str) -> bool:
    try:
        data = base64.b64decode(stored)
        salt, dk = data[:16], data[16:]
        return hmac.compare_digest(dk, hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000))
    except Exception:
        return False

def handler(event: dict, context) -> dict:
    """Регистрация, вход и верификация JWT-токена"""
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

    if (path.endswith('/register') or path == '/') and method == 'POST' and (body.get('name') or body.get('email')):
        path = path if path.endswith('/register') else '/register'
    if path.endswith('/register') and method == 'POST':
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')
        name = body.get('name', '').strip()
        phone = body.get('phone', '').strip()

        if not email or not password or not name:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Имя, email и пароль обязательны'})}
        if len(password) < 6:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 409, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Email уже зарегистрирован'})}

        ph = hash_password(password)
        cur.execute("SELECT COUNT(*) FROM users")
        is_first = cur.fetchone()[0] == 0
        role_to_assign = 'admin' if is_first else 'user'
        cur.execute(
            "INSERT INTO users (email, phone, name, password_hash, role) VALUES (%s, %s, %s, %s, %s) RETURNING id, role",
            (email, phone or None, name, ph, role_to_assign)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()

        user_id, role = row
        exp = int((datetime.utcnow() + timedelta(days=30)).timestamp())
        token = make_jwt({'user_id': user_id, 'email': email, 'role': role, 'exp': exp})
        return {
            'statusCode': 201,
            'headers': CORS_HEADERS,
            'body': json.dumps({'token': token, 'user': {'id': user_id, 'email': email, 'name': name, 'role': role}})
        }

    if path.endswith('/login') and method == 'POST':
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')

        if not email or not password:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Email и пароль обязательны'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, password_hash, role, avatar_url FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        conn.close()

        if not row or not check_password(password, row[2]):
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

        user_id, name, _, role, avatar_url = row
        exp = int((datetime.utcnow() + timedelta(days=30)).timestamp())
        token = make_jwt({'user_id': user_id, 'email': email, 'role': role, 'exp': exp})
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'token': token, 'user': {'id': user_id, 'email': email, 'name': name, 'role': role, 'avatar_url': avatar_url}})
        }

    if path.endswith('/me') and method == 'GET':
        auth = event.get('headers', {}).get('X-Authorization', '')
        token = auth.replace('Bearer ', '') if auth else ''
        payload = verify_jwt(token)
        if not payload:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, phone, role, avatar_url, created_at FROM users WHERE id = %s", (payload['user_id'],))
        row = cur.fetchone()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Пользователь не найден'})}

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'user': {'id': row[0], 'email': row[1], 'name': row[2], 'phone': row[3], 'role': row[4], 'avatar_url': row[5], 'created_at': str(row[6])}})
        }

    # Default: treat GET / as /me check
    if method == 'GET':
        auth = event.get('headers', {}).get('X-Authorization', '')
        token = auth.replace('Bearer ', '') if auth else ''
        payload = verify_jwt(token) if token else None
        if not payload:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}

    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}