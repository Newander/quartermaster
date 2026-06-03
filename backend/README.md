# Quartermaster System - Backend API

A comprehensive backend service for managing a HEMA (Historical European Martial Arts) gym, built with FastAPI, SQLAlchemy, Alembic, and a MySQL/SQLite-compatible development setup.

## Features

### Core Business Functions

- **Member Management**: Register, update, and track gym members
- **Instructor Management**: Manage instructor profiles and specializations
- **Training Forms**: Define different training disciplines (Longsword, Rapier, etc.)
- **Scheduling**: Create and manage weekly training schedules
- **Attendance Tracking**: Record member attendance for training sessions
- **Membership Plans**: Define subscription types (monthly, visit-based)
- **Payment Tracking**: Monitor membership payments and payment status
- **Special Events**: Organize workshops, tournaments, and special events
- **Event Registration**: Track member registrations and payments for events
- **Expense Management**: Record monthly gym expenses and event-specific costs
- **Statistics & Reports**: Generate comprehensive reports (monthly, quarterly, yearly)

## Technology Stack

- **Python 3.14**
- **FastAPI** - Modern web framework for building APIs
- **SQLAlchemy** - SQL toolkit and ORM
- **MySQL / SQLite** - MySQL for Docker demo, SQLite-compatible local development paths
- **Pydantic** - Data validation using Python type annotations
- **Uvicorn** - ASGI server

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   │   ├── members.py          # Member management endpoints
│   │   │   ├── instructors.py      # Instructor management endpoints
│   │   │   ├── training.py         # Training forms, schedules, sessions
│   │   │   ├── memberships.py      # Membership plans and payments
│   │   │   ├── events.py           # Events and expenses
│   │   │   └── statistics.py       # Statistics and reports
│   │   └── api.py                  # API router
│   ├── core/
│   │   └── config.py                   # Application configuration
│   ├── db/
│   │   └── database.py                 # Database configuration
│   ├── models/
│   │   ├── member.py                   # Member model
│   │   ├── instructor.py               # Instructor model
│   │   ├── training.py                 # Training-related models
│   │   ├── membership.py               # Membership and payment models
│   │   └── event.py                    # Event and expense models
│   └── schemas/
│       ├── member.py                   # Member schemas
│       ├── instructor.py               # Instructor schemas
│       ├── training.py                 # Training schemas
│       ├── membership.py               # Membership schemas
│       ├── event.py                    # Event schemas
│       └── statistics.py               # Statistics schemas
├── main.py                             # Application entry point
├── requirements.txt                    # Python dependencies
└── README.md                           # This file
```

## Installation

1. **Clone the repository** (if applicable)

2. **Create and activate virtual environment**:
```bash
python3.14 -m venv .venv
source .venv/bin/activate  # On macOS/Linux
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

For the Docker-based full-stack demo, use the repository root `docker-compose.yml`; it starts MySQL, the backend, fixtures, and the frontend.

## Running the Application

### Development Server

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive API docs (Swagger)**: http://localhost:8000/docs
- **Alternative API docs (ReDoc)**: http://localhost:8000/redoc

## API Endpoints

### Members
- `POST /api/members` - Create a new member
- `GET /api/members` - List all members
- `GET /api/members/{id}` - Get member details
- `PUT /api/members/{id}` - Update member
- `DELETE /api/members/{id}` - Delete member

### Instructors
- `POST /api/instructors` - Create a new instructor
- `GET /api/instructors` - List all instructors
- `GET /api/instructors/{id}` - Get instructor details
- `PUT /api/instructors/{id}` - Update instructor
- `DELETE /api/instructors/{id}` - Delete instructor

### Training
- `POST /api/training/forms` - Create training form
- `GET /api/training/forms` - List training forms
- `POST /api/training/schedules` - Create schedule
- `GET /api/training/schedules` - List schedules
- `POST /api/training/sessions` - Create training session
- `GET /api/training/sessions` - List sessions
- `POST /api/training/attendance` - Record attendance
- `GET /api/training/attendance` - Get attendance records

### Memberships
- `POST /api/memberships/plans` - Create membership plan
- `GET /api/memberships/plans` - List membership plans
- `POST /api/memberships` - Create membership
- `GET /api/memberships` - List memberships
- `POST /api/memberships/payments` - Record payment
- `GET /api/memberships/payments` - List payments

### Events
- `POST /api/events` - Create event
- `GET /api/events` - List events
- `POST /api/events/registrations` - Register for event
- `GET /api/events/registrations` - List registrations
- `POST /api/events/expenses` - Record event expense
- `POST /api/events/general-expenses` - Record monthly expense
- `GET /api/events/general-expenses` - List monthly expenses

### Statistics
- `GET /api/statistics/members` - Get member statistics
- `GET /api/statistics/financial` - Get financial summary
- `GET /api/statistics/attendance` - Get attendance statistics
- `GET /api/statistics/reports/monthly/{year}/{month}` - Monthly report
- `GET /api/statistics/reports/quarterly/{year}/{quarter}` - Quarterly report
- `GET /api/statistics/reports/yearly/{year}` - Yearly report

## Database

The application uses SQLite database (`hema_gym.db`) which is automatically created on first run. The database includes the following tables:

- `members` - Gym members
- `instructors` - Gym instructors
- `training_forms` - Training disciplines
- `schedules` - Weekly training schedules
- `training_sessions` - Specific training session instances
- `training_session_attendances` - Attendance records
- `membership_plans` - Available membership types
- `memberships` - Member subscriptions
- `payments` - Payment records
- `events` - Special events
- `event_registrations` - Event registrations
- `event_expenses` - Event-specific expenses
- `monthly_expenses` - Regular gym expenses

## Configuration

Configuration is managed through `app/core/config.py`. You can override settings using environment variables or a `.env` file:

```env
APP_NAME=Quartermaster System
APP_VERSION=1.0.0
DATABASE_URL=sqlite:///./hema_gym.db
```

## Development

### Adding New Features

1. Create model in `app/models/`
2. Create schema in `app/schemas/`
3. Create endpoint in `app/api/endpoints/`
4. Register router in `app/api/api.py`

### Database Migrations

For production use, consider using Alembic for database migrations:

```bash
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## API Documentation

Once the server is running, visit:
- http://localhost:8000/docs for interactive Swagger UI documentation
- http://localhost:8000/redoc for ReDoc documentation

## Testing

To test the API, you can use:
- The built-in Swagger UI at `/docs`
- curl commands
- Postman or similar API testing tools
- Python requests library

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/members" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890"
  }'
```

## License

This project is created for managing HEMA gym operations.

## Support

For issues or questions, please refer to the API documentation at `/docs` endpoint.
