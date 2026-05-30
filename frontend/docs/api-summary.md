# Backend API Summary

Generated: 2026-03-11
Source: backend-openapi.json
OpenAPI: 3.1.0
Title: Quartermaster System
Version: 1.0.0

## Description
Backend API for Quartermaster CRM System

## Inventory
- Paths: 66
- Operations: 129
- Tags: 16
- Schemas: 134
- Security schemes: OAuth2PasswordBearer

## Tags (operation counts)
- Admin: 10
- Authentication: 13
- Edit: 53
- HR / Roles & Permissions: 13
- Permissions: 10
- Roles: 10
- contract: 7
- events: 15
- graphql: 2
- instructor: 5
- member: 1
- membership: 20
- shelves: 19
- statistics: 15
- training: 29
- untagged: 3

## Common Query Params
- limit: 21
- skip: 20
- start_date: 10
- end_date: 10
- member_id: 8
- plan_id: 6
- expense_id: 6
- role_id: 6
- season_id: 5
- order_by_col: 5

## Example Endpoints
- GET /
- POST /api/auth/login
- GET /api/auth/me
- GET /api/auth/permissions
- POST /api/auth/permissions
- POST /api/auth/register
- GET /api/auth/roles
- POST /api/auth/roles
- DELETE /api/auth/roles/{role_id}
- GET /api/auth/roles/{role_id}
- DELETE /api/auth/roles/{role_id}/permissions/{permission_id}
- POST /api/auth/roles/{role_id}/permissions/{permission_id}
- DELETE /api/auth/users/{user_id}/roles/{role_id}
- POST /api/auth/users/{user_id}/roles/{role_id}
- GET /api/contract/
- POST /api/contract/
- GET /api/contract/member/{member_id}/contract
- POST /api/contract/member/{member_id}/contract
- PUT /api/contract/member/{member_id}/contract/{member_contract_id}
- GET /api/contract/{contract_id}

## Schemas (sample)
- AttendanceCreate
- AttendanceListResponse
- AttendanceResponse
- AttendanceStatistics
- Body_login_for_access_token_api_auth_login_post
- CheckPointBase
- CheckPointEdit
- CheckPointFull
- CheckPointList
- ContractCreate
- ContractListResponse
- ContractResponse
- ContractSummary
- ContractUpdate
- DayOfWeek
- EventCreate
- EventExpenseCreate
- EventExpenseListResponse
- EventExpenseResponse
- EventExpenseSummary
