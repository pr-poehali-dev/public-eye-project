import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
}

CATEGORY_LABELS = {
    'roads': 'Дороги', 'garbage': 'Мусор', 'utilities': 'ЖКХ',
    'traffic_lights': 'Светофоры', 'signs': 'Дорожные знаки',
    'lighting': 'Освещение', 'landscaping': 'Благоустройство', 'other': 'Другое'
}

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def handler(event: dict, context) -> dict:
    """Статистика жалоб: общие метрики, топ категорий, топ проблем по поддержкам"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    conn = get_db()
    cur = conn.cursor()

    # Общая статистика
    cur.execute("SELECT COUNT(*) FROM complaints WHERE is_spam = FALSE")
    total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM complaints WHERE status = 'resolved' AND is_spam = FALSE")
    resolved = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM complaints WHERE status = 'in_progress' AND is_spam = FALSE")
    in_progress = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM complaints WHERE status = 'new' AND is_spam = FALSE")
    new_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM complaints WHERE status = 'rejected' AND is_spam = FALSE")
    rejected = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM users")
    users_total = cur.fetchone()[0]

    # Топ категорий
    cur.execute("""
        SELECT category, COUNT(*) as cnt
        FROM complaints WHERE is_spam = FALSE
        GROUP BY category ORDER BY cnt DESC
    """)
    categories = [
        {'category': r[0], 'label': CATEGORY_LABELS.get(r[0], r[0]), 'count': r[1]}
        for r in cur.fetchall()
    ]

    # Топ жалоб по поддержкам
    cur.execute("""
        SELECT c.id, c.title, c.category, c.status, c.supports_count, c.address, c.created_at,
               u.name as author_name
        FROM complaints c LEFT JOIN users u ON c.user_id = u.id
        WHERE c.is_spam = FALSE
        ORDER BY c.supports_count DESC LIMIT 10
    """)
    top_complaints = [
        {
            'id': r[0], 'title': r[1], 'category': r[2],
            'category_label': CATEGORY_LABELS.get(r[2], r[2]),
            'status': r[3], 'supports_count': r[4],
            'address': r[5], 'created_at': str(r[6]),
            'author_name': r[7]
        }
        for r in cur.fetchall()
    ]

    # Динамика по месяцам (последние 6 месяцев)
    cur.execute("""
        SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM complaints WHERE is_spam = FALSE AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month ASC
    """)
    monthly = [{'month': r[0], 'count': r[1]} for r in cur.fetchall()]

    # Статистика по статусам для диаграммы
    status_data = [
        {'status': 'new', 'label': 'Новые', 'count': new_count, 'color': '#F59E0B'},
        {'status': 'in_progress', 'label': 'В работе', 'count': in_progress, 'color': '#3B82F6'},
        {'status': 'resolved', 'label': 'Решено', 'count': resolved, 'color': '#10B981'},
        {'status': 'rejected', 'label': 'Отклонено', 'count': rejected, 'color': '#EF4444'},
    ]

    conn.close()
    resolve_rate = round((resolved / total * 100), 1) if total > 0 else 0

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'total': total, 'resolved': resolved, 'in_progress': in_progress,
            'new': new_count, 'rejected': rejected, 'users_total': users_total,
            'resolve_rate': resolve_rate,
            'categories': categories, 'top_complaints': top_complaints,
            'monthly': monthly, 'status_data': status_data
        })
    }
