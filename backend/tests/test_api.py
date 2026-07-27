import pytest
from httpx import AsyncClient
import io


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_docs_available(client: AsyncClient):
    response = await client.get("/docs")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_file_upload(client: AsyncClient, auth_headers: dict):
    content = b"Hello, this is a test file content for question generation."
    response = await client.post(
        "/api/v1/files/upload",
        files={"file": ("test.txt", content, "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "test.txt"
    assert data["extension"] == "txt"
    assert data["file_size"] == len(content)
    assert data["is_processed"] is False
    return data["id"]


@pytest.mark.asyncio
async def test_file_upload_pdf(client: AsyncClient, auth_headers: dict):
    content = b"fake pdf content"
    response = await client.post(
        "/api/v1/files/upload",
        files={"file": ("test.pdf", content, "application/pdf")},
        headers=auth_headers,
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_file_list(client: AsyncClient, auth_headers: dict):
    await test_file_upload(client, auth_headers)
    response = await client.get("/api/v1/files/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_file_get(client: AsyncClient, auth_headers: dict):
    file_id = await test_file_upload(client, auth_headers)
    response = await client.get(f"/api/v1/files/{file_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == file_id


@pytest.mark.asyncio
async def test_file_delete(client: AsyncClient, auth_headers: dict):
    file_id = await test_file_upload(client, auth_headers)
    response = await client.delete(f"/api/v1/files/{file_id}", headers=auth_headers)
    assert response.status_code == 200

    response = await client.get(f"/api/v1/files/{file_id}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_paper_generation(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/questions/generate",
        json={
            "exam_name": "KAS Prelims Test",
            "language": "english",
            "question_count": 5,
            "difficulty": "balanced",
            "paper_set": "set_1",
            "source_file_ids": [],
            "previous_year_ids": [],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_syllabus_list(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/syllabus/", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_exam_patterns(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/syllabus/exam-patterns", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_search(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/search/?q=test&entity_type=all", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "test"
    assert "results" in data


@pytest.mark.asyncio
async def test_admin_dashboard(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/admin/dashboard", headers=auth_headers)
    assert response.status_code == 200
    assert "stats" in response.json()


@pytest.mark.asyncio
async def test_admin_users(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/admin/users", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_admin_audit_logs(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/admin/audit-logs", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_admin_settings(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/admin/settings", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_admin_jobs(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/admin/jobs", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_pdf_reader_notes(client: AsyncClient, auth_headers: dict):
    file_id = await test_file_upload(client, auth_headers)
    response = await client.post(
        "/api/v1/pdf-reader/notes",
        json={
            "file_id": file_id,
            "page_number": 1,
            "note_type": "highlight",
            "content": "Important note",
            "color": "#FFFF00",
            "position_x": 100.0,
            "position_y": 200.0,
            "text_content": "highlighted text",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    note_data = response.json()
    assert note_data["note_type"] == "highlight"
    assert note_data["page_number"] == 1

    response = await client.get(f"/api/v1/pdf-reader/notes/{file_id}", headers=auth_headers)
    assert response.status_code == 200
    notes = response.json()
    assert len(notes) >= 1


@pytest.mark.asyncio
async def test_pdf_reader_bookmarks(client: AsyncClient, auth_headers: dict):
    file_id = await test_file_upload(client, auth_headers)
    response = await client.post(
        "/api/v1/pdf-reader/bookmarks",
        json={
            "file_id": file_id,
            "page_number": 5,
            "label": "Important Section",
            "color": "#FF0000",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "Important Section"
    assert data["page_number"] == 5

    response = await client.get(f"/api/v1/pdf-reader/bookmarks/{file_id}", headers=auth_headers)
    assert response.status_code == 200
    bookmarks = response.json()
    assert len(bookmarks) >= 1


@pytest.mark.asyncio
async def test_pdf_reader_annotations(client: AsyncClient, auth_headers: dict):
    file_id = await test_file_upload(client, auth_headers)
    response = await client.post(
        "/api/v1/pdf-reader/annotations",
        json={
            "file_id": file_id,
            "page_number": 3,
            "annotation_type": "text",
            "content": "This is an annotation",
            "position_x": 50.0,
            "position_y": 75.0,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["annotation_type"] == "text"

    response = await client.get(f"/api/v1/pdf-reader/annotations/{file_id}", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_question_bank_search(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/questions/question-bank", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()


@pytest.mark.asyncio
async def test_papers_list(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/questions/papers", headers=auth_headers)
    assert response.status_code == 200
    assert "items" in response.json()
