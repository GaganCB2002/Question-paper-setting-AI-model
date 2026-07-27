import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={
        "email": "newuser@test.com",
        "username": "newuser",
        "full_name": "New User",
        "password": "NewUserPass123!",
        "role": "student",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@test.com"
    assert data["username"] == "newuser"
    assert "password" not in data


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "dup@test.com",
        "username": "dupuser",
        "full_name": "Dup User",
        "password": "DupPass123!",
    })
    response = await client.post("/api/v1/auth/register", json={
        "email": "dup@test.com",
        "username": "dupuser",
        "full_name": "Dup User",
        "password": "DupPass123!",
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@test.com",
        "username": "loginuser",
        "full_name": "Login User",
        "password": "LoginPass123!",
    })
    response = await client.post("/api/v1/auth/login", json={
        "username": "loginuser",
        "password": "LoginPass123!",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "loginuser"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "fail@test.com",
        "username": "failuser",
        "full_name": "Fail User",
        "password": "FailPass123!",
    })
    response = await client.post("/api/v1/auth/login", json={
        "username": "failuser",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] is not None
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "refresh@test.com",
        "username": "refreshuser",
        "full_name": "Refresh User",
        "password": "Refresh123!",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "refreshuser",
        "password": "Refresh123!",
    })
    login_data = login_resp.json()
    response = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": login_data["refresh_token"],
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, test_user, auth_headers: dict):
    response = await client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "TestPass123!", "new_password": "NewPass123!"},
        headers=auth_headers,
    )
    assert response.status_code == 200

    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "NewPass123!",
    })
    assert login_resp.status_code == 200
