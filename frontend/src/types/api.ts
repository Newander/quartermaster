// Enums
export enum DayOfWeek {
    MONDAY = 'monday',
    TUESDAY = 'tuesday',
    WEDNESDAY = 'wednesday',
    THURSDAY = 'thursday',
    FRIDAY = 'friday',
    SATURDAY = 'saturday',
    SUNDAY = 'sunday',
}

export enum MembershipType {
    MONTHLY = 'monthly',
    VISITS = 'visits',
}

export enum PaymentStatus {
    SCHEDULED = 'scheduled',
    PENDING = 'pending',
    PAID = 'paid',
    OVERDUE = 'overdue',
    CANCELLED = 'cancelled',
}

export enum PaymentMethod {
    TRANSFER = 'transfer',
    CASH = 'cash',
    CARD = 'card',
    BLIK = 'blik',
    BARTER = 'barter',
}

export enum ScheduleCycle {
    WEEKLY = 'weekly',
    BI_WEEKLY = 'bi-weekly',
    MONTHLY = 'monthly',
}

export enum ShelfStatus {
    AVAILABLE = 'available',
    OCCUPIED = 'occupied',
    MAINTENANCE = 'maintenance',
    RESERVED = 'reserved',
}

// Member Types
export interface MemberCreate {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    date_of_birth?: string | null;
    notes?: string | null;
}

export interface MemberUpdate {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
    is_active?: boolean | null;
    notes?: string | null;
}

export interface MemberResponse {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    date_of_birth?: string | null;
    notes?: string | null;
    registration_date: string;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface MemberListResponse {
    total: number;
    members: MemberResponse[];
}

// Instructor Types
export interface InstructorCreate {
    member_id: number;
    specialization: string;
    bio?: string | null;
}

export interface InstructorUpdate {
    specialization?: string | null;
    bio?: string | null;
    is_active?: boolean | null;
}

export interface MemberSummary {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    is_active: boolean;
}

export interface InstructorResponse {
    id: number;
    member_id: number;
    specialization: string;
    bio?: string | null;
    is_active: boolean;
    hire_date: string;
    created_at: string;
    updated_at: string | null;
    member: MemberSummary;
    schedules?: any[];
    training_sessions?: any[];
}

export interface InstructorListResponse {
    total: number;
    instructors: InstructorResponse[];
}

// Training Form Types
export interface TrainingFormCreate {
    name: string;
    description?: string | null;
    instructor_id?: number | null;
}

export interface TrainingFormUpdate {
    name?: string | null;
    description?: string | null;
    instructor_id?: number | null;
    is_active?: boolean | null;
}

export interface TrainingFormResponse {
    id: number;
    name: string;
    description?: string | null;
    instructor_id?: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

// Season Types
export interface SeasonCreate {
    name: string;
    start_date: string; // ISO date (YYYY-MM-DD)
    end_date: string;   // ISO date (YYYY-MM-DD)
}

export interface SeasonUpdate {
    name?: string | null;
    start_date?: string | null; // ISO date
    end_date?: string | null;   // ISO date
    is_finished?: boolean | null;
}

export interface SeasonResponse {
    id: number;
    name: string;
    start_date: string; // ISO date
    end_date: string;   // ISO date
    is_finished: boolean;
}

export interface SeasonListResponse {
    total: number;
    seasons: SeasonResponse[];
}

export interface SeasonSummary {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
}

// Schedule Types
export interface ScheduleCreate {
    training_form_id: number;
    season_id: number;
    day_of_week: DayOfWeek;
    schedule_cycle: ScheduleCycle;
    start_time: string;
    end_time: string;
    max_participants?: number | null;
}

export interface ScheduleUpdate {
    training_form_id?: number | null;
    season_id?: number | null;
    day_of_week?: DayOfWeek | null;
    schedule_cycle?: ScheduleCycle | null;
    start_time?: string | null;
    end_time?: string | null;
    max_participants?: number | null;
    is_active?: boolean | null;
}

export interface TrainingFormSummary {
    id: number;
    name: string;
    is_active: boolean;
}

export interface ScheduleResponse {
    id: number;
    training_form_id: number;
    season_id: number;
    day_of_week: DayOfWeek;
    schedule_cycle: ScheduleCycle;
    start_time: string;
    end_time: string;
    max_participants?: number | null;
    is_deleted: boolean;
    training_form: TrainingFormSummary;
    seasons: SeasonSummary;
    created_at: string;
    updated_at: string | null;
}

export interface ScheduleListResponse {
    total: number;
    schedules: ScheduleResponse[];
}

// Training Session Types
export interface TrainingSessionCreate {
    schedule_id: number;
    session_date: string;
    notes?: string | null;
}

export interface TrainingSessionUpdate {
    notes?: string | null;
    is_cancelled?: boolean | null;
}

export interface TrainingSessionResponse {
    id: number;
    schedule_id: number;
    session_date: string;
    notes?: string | null;
    is_cancelled: boolean;
    created_at: string;
    updated_at: string | null;
}

// Attendance Types
export interface AttendanceCreate {
    session_id: number;
    member_id: number;
    attended?: boolean;
    notes?: string | null;
}

export interface AttendanceResponse {
    id: number;
    session_id: number;
    member_id: number;
    attended: boolean;
    notes?: string | null;
    created_at: string;
}

// Membership Plan Types
export interface MembershipPlanCreate {
    name: string;
    description?: string | null;
    membership_type: MembershipType;
    price: number;
    duration_days?: number | null;
    visit_count?: number | null;
    season_id: number;
}

export interface MembershipPlanUpdate {
    name?: string | null;
    description?: string | null;
    membership_type?: MembershipType | null;
    price?: number | null;
    duration_days?: number | null;
    visit_count?: number | null;
    season_id?: number | null;
    is_active?: boolean | null;
}

export interface MembershipPlanResponse {
    id: number;
    name: string;
    description?: string | null;
    membership_type: MembershipType;
    price: number;
    duration_days?: number | null;
    visit_count?: number | null;
    season_id: number;
    is_active: boolean;
    season: SeasonSummary;
    created_at: string;
    updated_at: string | null;
}

export interface MembershipPlanListResponse {
    total: number;
    plans: MembershipPlanResponse[];
}

// Membership Types
export interface MembershipCreate {
    member_id: number;
    plan_id: number;
    start_date: string;
}

export interface MembershipUpdate {
    end_date?: string | null;
    remaining_visits?: number | null;
    is_active?: boolean | null;
    payment_status?: PaymentStatus | null;
}

export interface MembershipResponse {
    id: number;
    member_id: number;
    plan_id: number;
    start_date: string;
    end_date?: string | null;
    remaining_visits?: number | null;
    is_active: boolean;
    payment_status: PaymentStatus;
    created_at: string;
    updated_at: string | null;
}

// Payment Types
export interface PaymentCreate {
    membership_id: number;
    amount: number;
    payment_date: string;
    payment_method?: string | null;
    notes?: string | null;
}

export interface PaymentUpdate {
    amount?: number | null;
    payment_date?: string | null;
    payment_method?: string | null;
    status?: PaymentStatus | null;
    notes?: string | null;
}

export interface PaymentResponse {
    id: number;
    amount: number;
    member_id?: number | null;
    shelf_id?: number | null;
    payment_date: string;
    payment_method?: string | null;
    status: PaymentStatus;
    notes?: string | null;
    created_at: string;
    updated_at: string | null;
}

// Event Types
export interface EventCreate {
    name: string;
    description?: string | null;
    event_date: string;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    max_participants?: number | null;
    price?: number;
}

export interface EventUpdate {
    name?: string | null;
    description?: string | null;
    event_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    max_participants?: number | null;
    price?: number | null;
    is_active?: boolean | null;
}

export interface EventResponse {
    id: number;
    name: string;
    description?: string | null;
    event_date: string;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    max_participants?: number | null;
    price: number;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

// Event Registration Types
export interface EventRegistrationCreate {
    event_id: number;
    member_id: number;
    amount_paid?: number;
    notes?: string | null;
}

export interface EventRegistrationUpdate {
    payment_status?: string | null;
    amount_paid?: number | null;
    notes?: string | null;
}

export interface EventRegistrationResponse {
    id: number;
    event_id: number;
    member_id: number;
    registration_date: string;
    payment_status: string;
    amount_paid: number;
    notes?: string | null;
    created_at: string;
}

// Event Expense Types
export interface EventExpenseCreate {
    event_id: number;
    description: string;
    amount: number;
    expense_date: string;
    category?: string | null;
    notes?: string | null;
}

export interface EventExpenseUpdate {
    description?: string | null;
    amount?: number | null;
    expense_date?: string | null;
    category?: string | null;
    notes?: string | null;
}

export interface EventExpenseResponse {
    id: number;
    event_id: number;
    description: string;
    amount: number;
    expense_date: string;
    category?: string | null;
    notes?: string | null;
    created_at: string;
    updated_at: string | null;
}

// Monthly Expense Types
export interface GeneralExpenseCreate {
    description: string;
    amount: number;
    expense_date: string;
    category_id: number;
    is_recurring?: boolean;
    notes?: string | null;
}

export interface GeneralExpenseUpdate {
    description?: string | null;
    amount?: number | null;
    expense_date?: string | null;
    category_id?: number | null;
    is_recurring?: boolean | null;
    notes?: string | null;
}

export interface GeneralExpenseResponse {
    id: number;
    description: string;
    amount: number;
    expense_date: string;
    category: MoneyCategoryResponse;
    is_recurring: boolean;
    notes?: string | null;
    created_at: string;
    updated_at: string | null;
}

// Statistics Types
export interface MemberStatistics {
    total_members: number;
    active_members: number;
    inactive_members: number;
    average_age?: number | null;
    new_members_this_month: number;
    new_members_this_year: number;
}

export interface FinancialSummary {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    membership_revenue: number;
    event_revenue: number;
    period_start: string;
    period_end: string;
}

export interface AttendanceStatistics {
    total_sessions: number;
    total_attendances: number;
    average_attendance_per_session: number;
    most_popular_training_form?: string | null;
    period_start: string;
    period_end: string;
}

export interface MonthlyReport {
    month: number;
    year: number;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    active_members: number;
    new_members: number;
    total_sessions: number;
    total_attendances: number;
}

export interface QuarterlyReport {
    quarter: number;
    year: number;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    active_members: number;
    total_sessions: number;
    total_attendances: number;
}

export interface YearlyReport {
    year: number;
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    active_members: number;
    new_members: number;
    total_sessions: number;
    total_attendances: number;
    average_monthly_revenue: number;
    average_monthly_expenses: number;
}


export interface MemberMonthReport {
    month: string;
    new_members: number;
    all_members: number;
}

export interface FinanceMonthReport {
    month: string;
    expense_amount: number;
    income_amount: number;
}


export interface TrainingScheduleFormReport {
    training_name: string;
    percent: number;
}


// Shelf Types
export interface ShelfCreate {
    shelf_number: string;
    location?: string | null;
    size?: string | null;
    description?: string | null;
}

export interface ShelfUpdate {
    shelf_number?: string | null;
    location?: string | null;
    size?: string | null;
    description?: string | null;
    status?: ShelfStatus | null;
    is_active?: boolean | null;
}

export interface ShelfResponse {
    id: number;
    shelf_number: string;
    location?: string | null;
    size?: string | null;
    description?: string | null;
    status: ShelfStatus;
    is_active: boolean;
}

export interface ShelfListResponse {
    total: number;
    shelves: ShelfResponse[];
}

// Shelf Plan Types
export interface ShelfPlanCreate {
    name: string;
    description?: string | null;
    price: number;
    duration_days: number;
}

export interface ShelfPlanUpdate {
    name?: string | null;
    description?: string | null;
    price?: number | null;
    duration_days?: number | null;
    is_active?: boolean | null;
}

export interface ShelfPlanResponse {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    duration_days: number;
    is_active: boolean;
}

// Shelf Rental Types
export interface ShelfRentalCreate {
    shelf_id: number;
    member_id: number;
    plan_id: number;
    start_date: string;
    notes?: string | null;
    payment_amount: number;
    payment_method?: string;
}

export interface ShelfRentalUpdate {
    is_active?: boolean | null;
    notes?: string | null;
}

export interface ShelfRentalResponse {
    id: number;
    shelf_id: number;
    member_id: number;
    plan_id: number;
    payment_id: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    notes?: string | null;
    shelf?: ShelfResponse | null;
    plan?: ShelfPlanResponse | null;
    payment?: PaymentResponse | null;
    contract?: ContractResponse | null;
    created_at: string;
    updated_at: string | null;
}

export interface ShelfRentalListResponse {
    total: number;
    rentals: ShelfRentalResponse[];
}

// Contract Types
export interface ContractCreate {
    title: string;
    description?: string | null;
    version?: string | null;
    effective_from?: string | null;
    effective_to?: string | null;
    is_active?: boolean | null;
}

export interface ContractUpdate {
    title?: string | null;
    description?: string | null;
    version?: string | null;
    effective_from?: string | null;
    effective_to?: string | null;
    is_active?: boolean | null;
}

export interface ContractResponse {
    id: number;
    title: string;
    description?: string | null;
    version?: string | null;
    effective_from?: string | null;
    effective_to?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
    assigned_count?: number; // total member assignments
    signed_count?: number;   // total member signatures
}

export interface MemberContractCreateInput {
    contract_id: number;
    signed?: boolean;
    signed_at?: string | null;
    notes?: string | null;
}

export interface MemberContractUpdateInput {
    signed?: boolean | null;
    signed_at?: string | null;
    notes?: string | null;
}

export interface MemberContractResponse {
    id: number;
    member_id: number;
    contract_id: number;
    signed: boolean;
    signed_at?: string | null;
    notes?: string | null;
    created_at: string;
    updated_at: string | null;
}

// Checkpoint Types
export interface CheckpointCreate {
    date: string;
    balance: number;
}

export interface CheckpointUpdate {
    balance: number;
}

export interface CheckpointResponse {
    date: string;
    balance: number;
    created_at: string;
    updated_at: string | null;
}

export interface CheckpointListResponse {
    total: number;
    checkpoints: CheckpointResponse[];
}

// Money Category Types
export interface MoneyCategoryResponse {
    id: number;
    name: string;
}
