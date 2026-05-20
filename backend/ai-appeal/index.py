import json
import os
import psycopg2
import urllib.request

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
}

CATEGORY_LABELS = {
    'roads': 'Дороги', 'garbage': 'Мусор', 'utilities': 'ЖКХ',
    'traffic_lights': 'Светофоры', 'signs': 'Дорожные знаки',
    'lighting': 'Освещение', 'landscaping': 'Благоустройство', 'other': 'Другое'
}

CATEGORY_RECIPIENTS = {
    'roads': 'Администрацию города (отдел дорожного хозяйства)',
    'garbage': 'Администрацию города (отдел благоустройства и ЖКХ)',
    'utilities': 'Управляющую компанию / ГУК',
    'traffic_lights': 'ГИБДД / Администрацию (отдел ГИБДД)',
    'signs': 'ГИБДД',
    'lighting': 'Горсвет / Администрацию города',
    'landscaping': 'Администрацию города (отдел благоустройства)',
    'other': 'Администрацию города',
}

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def generate_appeal_text(complaint: dict) -> str:
    category = complaint.get('category', 'other')
    category_label = CATEGORY_LABELS.get(category, 'Другое')
    recipient = CATEGORY_RECIPIENTS.get(category, 'Администрацию города')
    address = complaint.get('address', 'не указан')
    description = complaint.get('description', '')
    title = complaint.get('title', '')
    date = str(complaint.get('created_at', ''))[:10]

    appeal = f"""Кому: {recipient}
От: жителя города

ОБРАЩЕНИЕ

Прошу рассмотреть следующую проблему и принять необходимые меры для её устранения.

Категория проблемы: {category_label}
Адрес: {address}
Дата обнаружения: {date}

Суть обращения:
{title}

{description}

Данная проблема негативно влияет на качество жизни жителей города и требует оперативного решения. Прошу:
1. Рассмотреть данное обращение в установленные законодательством сроки.
2. Принять меры по устранению указанной проблемы.
3. Уведомить о результатах рассмотрения.

С уважением,
Житель города

(Обращение сформировано через сервис «Глаз Народа» — платформу гражданских жалоб)"""
    return appeal

def handler(event: dict, context) -> dict:
    """Формирование официального обращения на основе жалобы (ИИ-помощник)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    complaint_id = body.get('complaint_id')
    complaint_data = body.get('complaint')

    if complaint_id:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, description, category, address, created_at
            FROM complaints WHERE id = %s AND is_spam = FALSE
        """, (complaint_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Жалоба не найдена'})}
        complaint_data = {
            'id': row[0], 'title': row[1], 'description': row[2],
            'category': row[3], 'address': row[4], 'created_at': str(row[5])
        }

    if not complaint_data:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не указаны данные жалобы'})}

    appeal_text = generate_appeal_text(complaint_data)
    recipient = CATEGORY_RECIPIENTS.get(complaint_data.get('category', 'other'), 'Администрацию города')

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'appeal': appeal_text, 'recipient': recipient})
    }
