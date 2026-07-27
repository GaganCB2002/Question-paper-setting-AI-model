import json, requests, sys, io

BASE = 'http://localhost:8000/api/v1'

r = requests.post(BASE + '/auth/login', json={'username':'test_e2e','password':'Test123!'}, timeout=10)
if r.status_code != 200:
    print(f'LOGIN FAILED: {r.status_code} {r.text}')
    sys.exit(1)
token = r.json()['access_token']
refresh = r.json()['refresh_token']
user_id = r.json()['user']['id']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
print(f'Logged in as {r.json()["user"]["username"]} (id={user_id})')

results = {'pass': 0, 'fail': 0, 'errors': []}

def test(method, path, label=None, expect=None, **kwargs):
    url = f'{BASE}{path}' if path.startswith('/') else f'http://localhost:8000{path}'
    lbl = label or f'{method} {path}'
    try:
        h = dict(headers)
        if 'headers' in kwargs:
            h.update(kwargs.pop('headers'))
        r = requests.request(method, url, headers=h, timeout=15, **kwargs)
        status = r.status_code
        ok = expect is None or status == expect
        if ok:
            results['pass'] += 1
            print(f'  OK {lbl:55s} -> {status}')
        else:
            results['fail'] += 1
            print(f'  FAIL {lbl:55s} -> {status} (expected {expect}) {r.text[:150]}')
            results['errors'].append(f'{lbl}: {status} vs expected {expect}: {r.text[:150]}')
        return r
    except Exception as e:
        results['fail'] += 1
        print(f'  ERROR {lbl:55s} -> {e}')
        results['errors'].append(f'{lbl}: {e}')
        return None

print()
print('=== AUTH ENDPOINTS ===')
test('GET', '/auth/me', expect=200)
test('PUT', '/auth/me', expect=200, json={'full_name':'Updated User'})
test('POST', '/auth/refresh', expect=200, headers={'Content-Type':'application/json'}, json={'refresh_token': refresh})
test('POST', '/auth/change-password', expect=200, json={'old_password':'Test123!','new_password':'NewPass456!'})
test('POST', '/auth/change-password', expect=200, json={'old_password':'NewPass456!','new_password':'Test123!'})

print()
print('=== FOLDER ENDPOINTS ===')
r = test('POST', '/folders/', expect=201, json={'name':'TestFolder','description':'E2E test folder','color':'#ff6600'})
folder_id = r.json()['id'] if r and r.status_code == 201 else None
print(f'     Created folder: {folder_id}')

if folder_id:
    test('POST', '/folders/', expect=201, json={'name':'SubFolder','parent_id':folder_id})
    test('GET', '/folders/', expect=200)
    test('GET', f'/folders/{folder_id}', expect=200)
    test('GET', '/folders/tree', expect=200)
    test('PUT', f'/folders/{folder_id}', expect=200, json={'name':'RenamedFolder','description':'Updated'})
    test('PUT', f'/folders/{folder_id}/move', expect=200)

print()
print('=== FILE ENDPOINTS ===')
pdf_bytes = b'%PDF-1.4 test file content\n' * 100
files = {'file': ('test.pdf', io.BytesIO(pdf_bytes), 'application/pdf')}
r = test('POST', '/files/upload', label='POST /files/upload (pdf)', expect=201, headers={'Authorization': f'Bearer {token}'}, files=files)
file_id = r.json()['id'] if r and r.status_code == 201 else None
print(f'     Uploaded file: {file_id}')

if file_id:
    test('GET', '/files/', expect=200)
    test('GET', f'/files/{file_id}', expect=200)

files2 = {'file': ('test.txt', io.BytesIO(b'Hello World!'), 'text/plain')}
r2 = test('POST', '/files/upload', label='POST /files/upload (txt)', expect=201, headers={'Authorization': f'Bearer {token}'}, files=files2)
txt_file_id = r2.json()['id'] if r2 and r2.status_code == 201 else None

if file_id:
    test('POST', f'/files/process/{file_id}', label=f'POST /files/process/{file_id}', expect=200)

print()
print('=== PDF DOWNLOAD ===')
if file_id:
    r = requests.get(f'{BASE}/files/{file_id}/download', headers={'Authorization': f'Bearer {token}'}, timeout=10)
    print(f'  GET /files/{file_id}/download -> {r.status_code} (len={len(r.content)})')

print()
print('=== PDF READER ENDPOINTS ===')
if file_id:
    r = test('POST', '/pdf-reader/notes', expect=201, json={'file_id': file_id, 'page_number': 1, 'note_type': 'text', 'content':'Test note', 'color':'#ffff00', 'position_x': 100, 'position_y': 200})
    note_id = r.json()['id'] if r and r.status_code == 201 else None
    print(f'     Created note: {note_id}')
    if note_id:
        test('GET', f'/pdf-reader/notes/{file_id}', expect=200)
        test('PUT', f'/pdf-reader/notes/{note_id}/archive', expect=200)

    r = test('POST', '/pdf-reader/bookmarks', expect=201, json={'file_id': file_id, 'page_number': 5, 'label':'Chapter 1'})
    bm_id = r.json()['id'] if r and r.status_code == 201 else None
    if bm_id:
        test('GET', f'/pdf-reader/bookmarks/{file_id}', expect=200)
        test('DELETE', f'/pdf-reader/bookmarks/{bm_id}', expect=204)

    r = test('POST', '/pdf-reader/annotations', expect=201, json={'file_id': file_id, 'page_number': 2, 'annotation_type':'highlight', 'content':'highlighted text', 'color':'#ff0000', 'rect_left':10, 'rect_top':20, 'rect_width':100, 'rect_height':30})
    ann_id = r.json()['id'] if r and r.status_code == 201 else None
    if ann_id:
        test('GET', f'/pdf-reader/annotations/{file_id}', expect=200)

print()
print('=== SEARCH ===')
test('GET', '/search/?q=test', expect=200)

print()
print('=== PROFILE ===')
test('GET', '/profile/tokens?days=30', expect=200)
test('GET', '/profile/quota', expect=200)
test('GET', '/profile/check-quota?required_tokens=100', expect=200)

print()
print('=== ADMIN ===')
test('GET', '/admin/dashboard', expect=200)
test('GET', '/admin/users', expect=200)
test('PUT', f'/admin/users/{user_id}', expect=200, json={'is_active': True})
test('GET', '/admin/audit-logs', expect=200)
test('GET', '/admin/settings', expect=200)
test('GET', '/admin/jobs', expect=200)

print()
print('=== SYLLABUS ===')
test('GET', '/syllabus/', expect=200)
test('GET', '/syllabus/exam-patterns', expect=200)

print()
print('=== QUESTIONS ===')
test('GET', '/questions/papers', expect=200)
test('GET', '/questions/question-bank', expect=200)

print()
print('=== TASKS ===')
test('GET', '/tasks/', expect=200)
r = test('POST', '/tasks/create-plan', expect=200, json={'syllabus_text':'Test syllabus content for KAS exam.','exam_name':'KAS','language':'english','difficulty':'medium','total_questions':10,'questions_per_phase':5})
task_id = r.json().get('task_id') if r and r.status_code == 200 else None
if task_id:
    print(f'     Created task: {task_id}')
    test('POST', f'/tasks/{task_id}/approve', expect=200, json={'approve': True, 'reason': 'Looks good'})
    test('GET', f'/tasks/{task_id}/status', expect=200)

print()
print('=== CLEANUP ===')
if file_id:
    test('DELETE', f'/files/{file_id}', expect=204)
if folder_id:
    test('DELETE', f'/folders/{folder_id}?recursive=true', label=f'DELETE /folders/{folder_id} (recursive)', expect=200)

print()
print(f'=== SUMMARY: {results["pass"]} passed, {results["fail"]} failed ===')
if results['errors']:
    print('Errors:')
    for e in results['errors']:
        print(f'  - {e}')
