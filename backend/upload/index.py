import json
import os
import base64
import uuid
import boto3

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

def handler(event: dict, context) -> dict:
    """Загрузка фото жалоб в S3-хранилище"""
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

    image_data = body.get('image')
    if not image_data:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет данных изображения'})}

    # Обработка base64
    if ',' in image_data:
        header, image_data = image_data.split(',', 1)
        ext = 'jpg'
        if 'png' in header:
            ext = 'png'
        elif 'gif' in header:
            ext = 'gif'
        elif 'webp' in header:
            ext = 'webp'
    else:
        ext = 'jpg'

    image_bytes = base64.b64decode(image_data)
    if len(image_bytes) > MAX_SIZE:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Файл слишком большой (макс 5МБ)'})}

    key = f"complaints/{uuid.uuid4()}.{ext}"
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    content_type = f'image/{ext}'
    s3.put_object(Bucket='files', Key=key, Body=image_bytes, ContentType=content_type)
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'url': cdn_url})
    }
