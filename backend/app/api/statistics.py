"""
Statistics and reporting API endpoints
"""
from datetime import date, timedelta
from typing import Literal, TypedDict

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.params import Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from starlette import status

from app.database import get_db
from app.models import CheckPoint, MembershipPayment
from app.models.event import Event
from app.models.event import EventRegistration, EventExpense
from app.models.hr import Member
from app.models.money import Expense
from app.models.money import Payment
from app.models.training import TrainingSession, TrainingSessionAttendance, TrainingForm
from app.schemas.statistics import (
    MemberStatistics,
    FinancialSummary,
    AttendanceStatistics,
    QuarterlyReport,
    MonthlyReport,
    YearlyReport, CheckPointFull, CheckPointBase, CheckPointEdit, CheckPointList
)


class FinancialSummaryDict(TypedDict):
    """Type definition for financial summary return dictionary"""
    checkpoint_balance: float
    total_revenue: float
    total_expenses: float
    net_profit: float
    membership_revenue: float
    event_revenue: float
    period_start: date
    period_end: date


stat_router = APIRouter()


@stat_router.get("/members", response_model=MemberStatistics)
@stat_router.get("/member", response_model=MemberStatistics)
def get_member_statistics(db: Session = Depends(get_db)):
    """Get member statistics"""
    total_members = db.query(Member).count()
    deleted_members = db.query(Member).filter(Member.is_deleted == True).count()
    existed_members = total_members - deleted_members

    # Calculate average age
    members_with_dob = db.query(Member).filter(Member.date_of_birth.isnot(None)).all()
    if members_with_dob:
        today = date.today()
        ages = [(today - m.date_of_birth).days / 365.25 for m in members_with_dob]
        average_age = sum(ages) / len(ages)
    else:
        average_age = None

    # New members this month
    first_day_of_month = date.today().replace(day=1)
    new_members_this_month = MembershipPayment.count_active_members(db, first_day_of_month, date.today())

    # New members this year
    first_day_of_year = date.today().replace(month=1, day=1)
    new_members_this_year = MembershipPayment.count_active_members(db, first_day_of_year, date.today())

    return {
        "total_members": total_members,
        "active_members": existed_members,
        "inactive_members": deleted_members,
        "average_age": average_age,
        "new_members_this_month": new_members_this_month,
        "new_members_this_year": new_members_this_year
    }


@stat_router.get("/financial", response_model=FinancialSummary)
def get_financial_summary(
        start_date: date,
        end_date: date,
        db: Session = Depends(get_db)
) -> FinancialSummaryDict:
    """Get financial summary for a period"""

    starting_balance = 0.0
    if checkpoints := db.query(CheckPoint).filter(CheckPoint.date <= end_date).order_by(CheckPoint.date.desc()).all():
        # 14 days luft added
        if (last_checkpoint := checkpoints[0]).date >= (start_date - timedelta(14)):
            starting_balance = last_checkpoint.balance

    # Total revenue from payments
    total_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_date >= start_date,
        Payment.payment_date <= end_date
    ).scalar() or 0.0

    # Membership revenue (payments with membership category)
    membership_revenue = db.query(func.sum(Payment.amount)).join(MembershipPayment).filter(
        Payment.payment_date >= start_date,
        Payment.payment_date <= end_date
    ).scalar() or 0.0

    # Event revenue - sum of prices from event registrations (with discount applied)
    # todo: unactual
    event_revenue = db.query(
        func.sum(Event.price - EventRegistration.discount)
    ).join(EventRegistration).filter(
        EventRegistration.registration_date >= start_date,
        EventRegistration.registration_date <= end_date
    ).scalar() or 0.0

    # Total expenses (general + event expenses)
    general_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.expense_date >= start_date,
        Expense.expense_date <= end_date
    ).scalar() or 0.0

    event_expenses = db.query(func.sum(EventExpense.amount)).filter(
        EventExpense.expense_date >= start_date,
        EventExpense.expense_date <= end_date
    ).scalar() or 0.0

    total_expenses = general_expenses + event_expenses
    net_profit = starting_balance + total_revenue - total_expenses

    return {
        "checkpoint_balance": starting_balance,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "membership_revenue": membership_revenue,
        "event_revenue": event_revenue,
        "period_start": start_date,
        "period_end": end_date
    }


@stat_router.get("/attendance", response_model=AttendanceStatistics)
def get_attendance_statistics(
        start_date: date,
        end_date: date,
        db: Session = Depends(get_db)
):
    """Get attendance statistics for a period"""
    total_sessions = db.query(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date,
        TrainingSession.is_cancelled == False
    ).count()

    total_attendances = db.query(TrainingSessionAttendance).join(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date,
        TrainingSessionAttendance.attended == True
    ).count()

    average_attendance = total_attendances / total_sessions if total_sessions > 0 else 0.0

    # Most popular training form
    popular_form = db.query(
        TrainingForm.name,
        func.count(TrainingSessionAttendance.id).label('count')
    ).join(
        TrainingSession.schedule
    ).join(
        TrainingSession.attendances
    ).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).group_by(TrainingForm.name).order_by(func.count(TrainingSessionAttendance.id).desc()).first()

    most_popular = popular_form[0] if popular_form else None

    return {
        "total_sessions": total_sessions,
        "total_attendances": total_attendances,
        "average_attendance_per_session": average_attendance,
        "most_popular_training_form": most_popular,
        "period_start": start_date,
        "period_end": end_date
    }


@stat_router.get("/reports/monthly/{year}/{month}", response_model=MonthlyReport)
def get_monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    """Get monthly report"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    # Get financial data
    financial = get_financial_summary(start_date, end_date, db)

    # Active members at end of month
    active_members = MembershipPayment.count_active_members(db, start_date, end_date)

    # New members this month
    new_members = Member.count_registered(db, start_date, end_date)

    # Sessions and attendance
    total_sessions = db.query(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    total_attendances = db.query(TrainingSessionAttendance).join(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    return {
        "month": month,
        "year": year,
        "total_revenue": financial["total_revenue"],
        "total_expenses": financial["total_expenses"],
        "net_profit": financial["net_profit"],
        "active_members": active_members,
        "new_members": new_members,
        "total_sessions": total_sessions,
        "total_attendances": total_attendances
    }


@stat_router.get("/reports/quarterly/{year}/{quarter}", response_model=QuarterlyReport)
def get_quarterly_report(year: int, quarter: int, db: Session = Depends(get_db)):
    """Get quarterly report (quarter: 1-4)"""
    if quarter not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4")

    start_month = (quarter - 1) * 3 + 1
    start_date = date(year, start_month, 1)
    end_date = date(year, start_month + 2, 1) + relativedelta(months=1) - timedelta(days=1)

    # Get financial data
    financial = get_financial_summary(start_date, end_date, db)

    # Active members at end of quarter
    active_members = MembershipPayment.count_active_members(db, start_date, end_date)

    # Sessions and attendance
    total_sessions = db.query(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    total_attendances = db.query(TrainingSessionAttendance).join(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    return {
        "quarter": quarter,
        "year": year,
        "total_revenue": financial["total_revenue"],
        "total_expenses": financial["total_expenses"],
        "net_profit": financial["net_profit"],
        "active_members": active_members,
        "total_sessions": total_sessions,
        "total_attendances": total_attendances
    }


@stat_router.get("/reports/yearly/{year}", response_model=YearlyReport)
def get_yearly_report(year: int, db: Session = Depends(get_db)):
    """Get yearly report"""
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    # Get financial data
    financial = get_financial_summary(start_date, end_date, db)

    # Active members at end of year
    active_members = MembershipPayment.count_active_members(db, start_date, end_date)

    # New members this year
    new_members = Member.count_registered(db, start_date, end_date)

    # Sessions and attendance
    total_sessions = db.query(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    total_attendances = db.query(TrainingSessionAttendance).join(TrainingSession).filter(
        TrainingSession.session_date >= start_date,
        TrainingSession.session_date <= end_date
    ).count()

    return {
        "year": year,
        "total_revenue": financial["total_revenue"],
        "total_expenses": financial["total_expenses"],
        "net_profit": financial["net_profit"],
        "active_members": active_members,
        "new_members": new_members,
        "total_sessions": total_sessions,
        "total_attendances": total_attendances,
        "average_monthly_revenue": financial["total_revenue"] / 12,
        "average_monthly_expenses": financial["total_expenses"] / 12
    }


@stat_router.get('/checkpoint')
def list_checkpoints(
        db: Session = Depends(get_db),
        # Paginating
        skip: int = 0,
        limit: int = 100,
        # Ordering
        order_by_col: str | None = None,
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # Filtering
        start_date: date | None = None,
        end_date: date | None = None,
) -> CheckPointList:
    query = db.query(CheckPoint)

    if start_date:
        query = query.filter(CheckPoint.date >= start_date)
    if end_date:
        query = query.filter(CheckPoint.date <= end_date)

    total = query.count()
    checkpoints = query.order_by(
        getattr(CheckPoint, order_by_col).asc() if order_by_asc == 'asc' else getattr(CheckPoint, order_by_col).desc()
    ).offset(skip).limit(limit).all()
    return CheckPointList.model_validate(dict(total=total, checkpoints=checkpoints))


@stat_router.get('/checkpoint/{checkpoint_date}', response_model=CheckPointFull)
def get_checkpoint(
        checkpoint_date: date,
        db: Session = Depends(get_db),
):
    if checkpoint := db.query(CheckPoint).filter(CheckPoint.date == checkpoint_date).first():
        return checkpoint

    raise HTTPException(status_code=404, detail="Checkpoint not found")


@stat_router.post('/checkpoint', response_model=CheckPointFull)
def create_checkpoint(
        new_checkpoint: CheckPointBase,
        db: Session = Depends(get_db),
):
    if db.query(CheckPoint).filter(CheckPoint.date == new_checkpoint.date).first():
        raise HTTPException(status_code=400, detail="Checkpoint already exists")

    checkpoint = CheckPoint(**new_checkpoint.model_dump())
    db.add(checkpoint)
    db.commit()
    db.refresh(checkpoint)
    return checkpoint


@stat_router.put('/checkpoint/{checkpoint_date}', response_model=CheckPointFull)
def update_checkpoint(
        checkpoint_date: date,
        updated_checkpoint: CheckPointEdit,
        db: Session = Depends(get_db),
):
    checkpoint: CheckPoint
    if not (checkpoint := db.query(CheckPoint).filter(CheckPoint.date == checkpoint_date).first()):
        raise HTTPException(status_code=404, detail="Checkpoint not found")

    checkpoint.balance = updated_checkpoint.balance
    db.commit()
    db.refresh(checkpoint)
    return checkpoint


@stat_router.delete('/checkpoint/{checkpoint_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_checkpoint(
        checkpoint_id: int,
        db: Session = Depends(get_db),
):
    checkpoint: CheckPoint
    if not (checkpoint := db.query(CheckPoint).filter(CheckPoint.id == checkpoint_id).first()):
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    db.delete(checkpoint)
    db.commit()


class MonthMembersSchema(BaseModel):
    """Schema for statistics"""
    month: str
    new_members: int
    all_members: int


@stat_router.get("/group/new-member/by-month")
def group_new_member_by_month(
        db: Session = Depends(get_db),
        start_date: date = Query(...),
        end_date: date = Query(...),
) -> list[MonthMembersSchema]:
    result = db.execute(
        text(f"""
            WITH RECURSIVE months AS (
                -- Start month
                SELECT date(:start_date, 'start of month') as month_date
                UNION ALL
                -- Generate next months
                SELECT date(month_date, '+1 month')
                FROM months
                WHERE month_date < date(:end_date, 'start of month'))
            , instant_members AS (
                select count(m.id) as cnt
                from main.member m
                where m.registration_date < date(:start_date, 'start of month')
            )
            select strftime('%Y-%m', months.month_date)               as month
                 , count(m.id)                                        as new_members
                 , instant_members.cnt + SUM(COUNT(m.id)) OVER (ORDER BY months.month_date) as all_members
            from months, instant_members
                     left join main.member m on strftime('%Y-%m', m.registration_date) = strftime('%Y-%m', months.month_date)
            group by month
            order by month
        """),
        params={'start_date': start_date, 'end_date': end_date}
    ).all()

    return [MonthMembersSchema(month=row[0], new_members=row[1], all_members=row[2]) for row in result]


class IncomeExpenseSchema(BaseModel):
    month: str
    expense_amount: float
    income_amount: float


@stat_router.get("/group/finance/by-month")
def group_finance_by_month(
        db: Session = Depends(get_db),
        start_date: date = Query(...),
        end_date: date = Query(...),
) -> list[IncomeExpenseSchema]:
    result = db.execute(
        text(f"""
            WITH RECURSIVE months AS (
                SELECT date(:start_date, 'start of month') as month_date
                UNION ALL
                SELECT date(month_date, '+1 month')
                FROM months
                WHERE month_date < date(:end_date, 'start of month'))
            select strftime('%Y-%m', months.month_date) as month
                 , coalesce(sum(exp.amount), 0)         as expense_amount
                 , coalesce(sum(pay.amount), 0)         as income_amount
            from months
                     left join main.expense exp
                               on strftime('%Y-%m', exp.expense_date) = strftime('%Y-%m', months.month_date) and exp.status = 'PAID'
                     left join main.payment pay
                               on strftime('%Y-%m', pay.payment_date) = strftime('%Y-%m', months.month_date) and pay.status = 'PAID'
            group by month
            order by month
        """),
        params={'start_date': start_date, 'end_date': end_date}
    ).all()

    return [
        IncomeExpenseSchema(month=row[0],
                            expense_amount=round(float(row[1]), 2),
                            income_amount=round(float(row[2]), 2))
        for row in result
    ]


class TrainingFormScheduleResponse(BaseModel):
    training_name: str
    percent: float


@stat_router.get("/group/training-forms/by-schedule")
def group_training_forms_by_schedule(
        db: Session = Depends(get_db)
) -> list[TrainingFormScheduleResponse]:
    result = db.execute(
        text("""
             with schedules_cnt as (select count(*) as cnt from main.schedule where is_deleted = 0)
             select trf.name                                             as training_name
                  , round(cast(count(*) as real) / schedules_cnt.cnt, 3) as scheduled
             from main.training_form trf,
                  schedules_cnt
                      join main.schedule s on trf.id = s.training_form_id
             where is_deleted = 0
             group by trf.name
             order by trf.name
             """)
    ).fetchall()
    return [
        TrainingFormScheduleResponse(
            training_name=row[0],
            percent=row[1]
        ) for row in result
    ]
