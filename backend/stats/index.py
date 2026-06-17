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

# Границы районов Самары [lat_min, lat_max, lng_min, lng_max]
SAMARA_DISTRICTS = [
    {'name': 'Ленинский',       'lat_min': 53.175, 'lat_max': 53.210, 'lng_min': 50.130, 'lng_max': 50.195, 'color': '#EF4444'},
    {'name': 'Самарский',       'lat_min': 53.180, 'lat_max': 53.215, 'lng_min': 50.180, 'lng_max': 50.250, 'color': '#F97316'},
    {'name': 'Октябрьский',     'lat_min': 53.195, 'lat_max': 53.240, 'lng_min': 50.140, 'lng_max': 50.210, 'color': '#F59E0B'},
    {'name': 'Железнодорожный', 'lat_min': 53.205, 'lat_max': 53.255, 'lng_min': 50.170, 'lng_max': 50.240, 'color': '#10B981'},
    {'name': 'Промышленный',    'lat_min': 53.215, 'lat_max': 53.280, 'lng_min': 50.180, 'lng_max': 50.290, 'color': '#3B82F6'},
    {'name': 'Советский',       'lat_min': 53.190, 'lat_max': 53.240, 'lng_min': 50.240, 'lng_max': 50.330, 'color': '#8B5CF6'},
    {'name': 'Кировский',       'lat_min': 53.230, 'lat_max': 53.310, 'lng_min': 50.270, 'lng_max': 50.400, 'color': '#06B6D4'},
    {'name': 'Красноглинский',  'lat_min': 53.270, 'lat_max': 53.380, 'lng_min': 50.160, 'lng_max': 50.350, 'color': '#84CC16'},
    {'name': 'Куйбышевский',    'lat_min': 53.155, 'lat_max': 53.205, 'lng_min': 50.070, 'lng_max': 50.160, 'color': '#EC4899'},
]

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def get_district(lat, lng):
    if lat is None or lng is None:
        return 'Другое'
    for d in SAMARA_DISTRICTS:
        if d['lat_min'] <= lat <= d['lat_max'] and d['lng_min'] <= lng <= d['lng_max']:
            return d['name']
    return 'Другое'

def handler(event: dict, context) -> dict:
    """Статистика жалоб: метрики, категории, топ, районы Самары"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    conn = get_db()
    cur = conn.cursor()

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

    cur.execute("""
        SELECT category, COUNT(*) as cnt FROM complaints WHERE is_spam = FALSE
        GROUP BY category ORDER BY cnt DESC
    """)
    categories = [
        {'category': r[0], 'label': CATEGORY_LABELS.get(r[0], r[0]), 'count': r[1]}
        for r in cur.fetchall()
    ]

    cur.execute("""
        SELECT c.id, c.title, c.category, c.status, c.supports_count, c.address, c.created_at, u.name
        FROM complaints c LEFT JOIN users u ON c.user_id = u.id
        WHERE c.is_spam = FALSE ORDER BY c.supports_count DESC LIMIT 10
    """)
    top_complaints = [
        {'id': r[0], 'title': r[1], 'category': r[2],
         'category_label': CATEGORY_LABELS.get(r[2], r[2]),
         'status': r[3], 'supports_count': r[4],
         'address': r[5], 'created_at': str(r[6]), 'author_name': r[7]}
        for r in cur.fetchall()
    ]

    cur.execute("""
        SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM complaints WHERE is_spam = FALSE AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month ASC
    """)
    monthly = [{'month': r[0], 'count': r[1]} for r in cur.fetchall()]

    status_data = [
        {'status': 'new',         'label': 'Новые',     'count': new_count,   'color': '#F59E0B'},
        {'status': 'in_progress', 'label': 'В работе',  'count': in_progress, 'color': '#3B82F6'},
        {'status': 'resolved',    'label': 'Решено',    'count': resolved,    'color': '#10B981'},
        {'status': 'rejected',    'label': 'Отклонено', 'count': rejected,    'color': '#EF4444'},
    ]

    # Районы — считаем по координатам
    cur.execute("SELECT lat, lng, status FROM complaints WHERE is_spam = FALSE AND lat IS NOT NULL AND lng IS NOT NULL")
    all_coords = cur.fetchall()

    district_stats = {d['name']: {'name': d['name'], 'color': d['color'], 'total': 0, 'resolved': 0, 'new': 0, 'in_progress': 0}
                      for d in SAMARA_DISTRICTS}
    district_stats['Другое'] = {'name': 'Другое', 'color': '#94A3B8', 'total': 0, 'resolved': 0, 'new': 0, 'in_progress': 0}

    for lat, lng, status in all_coords:
        d_name = get_district(float(lat), float(lng))
        if d_name not in district_stats:
            d_name = 'Другое'
        district_stats[d_name]['total'] += 1
        if status == 'resolved':
            district_stats[d_name]['resolved'] += 1
        elif status == 'new':
            district_stats[d_name]['new'] += 1
        elif status == 'in_progress':
            district_stats[d_name]['in_progress'] += 1

    districts_list = sorted(
        [v for v in district_stats.values()],
        key=lambda x: x['total'], reverse=True
    )

    conn.close()
    resolve_rate = round((resolved / total * 100), 1) if total > 0 else 0

    return {
        'statusCode': 200, 'headers': CORS_HEADERS,
        'body': json.dumps({
            'total': total, 'resolved': resolved, 'in_progress': in_progress,
            'new': new_count, 'rejected': rejected, 'users_total': users_total,
            'resolve_rate': resolve_rate,
            'categories': categories, 'top_complaints': top_complaints,
            'monthly': monthly, 'status_data': status_data,
            'districts': districts_list,
        })
    }
