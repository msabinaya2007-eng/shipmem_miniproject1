import os
import hmac

from datetime import date, datetime
from typing import Optional

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field
)

from sqlalchemy.orm import Session

from data_structures import (
    MaintenanceList,
    ActivityStack,
    MaintenanceQueue,
    VesselComponentTree,
    OperationalGraph
)

from database import engine, Base, SessionLocal
import models

from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    require_roles
)


# =====================================================
# APPLICATION SETUP
# =====================================================

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)
load_dotenv()

app = FastAPI(
    title="SHIPMEM API",
    description="Smart Vessel Maintenance and Operational Memory System",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


# =====================================================
# DATA STRUCTURES
# =====================================================

activity_stack = ActivityStack()
maintenance_queue = MaintenanceQueue()
component_tree = VesselComponentTree("Ocean Star")
operational_graph = OperationalGraph()


# =====================================================
# DATABASE CONNECTION
# =====================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =====================================================
# ACTIVITY LOGGER
# =====================================================

def log_activity(
    db: Session,
    action: str,
    description: str,
    vessel_id: Optional[int] = None
):
    activity = models.Activity(
        action=action,
        description=description,
        vessel_id=vessel_id
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return activity


# =====================================================
# NOTIFICATION HELPER
# =====================================================

def create_notification(
    db: Session,
    vessel_id: Optional[int],
    notification_type: str,
    message: str
):
    notification = models.Notification(
        vessel_id=vessel_id,
        notification_type=notification_type,
        message=message
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


# =====================================================
# PYDANTIC SCHEMAS
# =====================================================

# ---------------- VESSEL ----------------

class VesselCreate(BaseModel):
    vessel_name: str
    vessel_type: str
    imo_number: Optional[str] = None
    status: str = "Active"


class VesselResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vessel_id: int
    vessel_name: str
    vessel_type: Optional[str]
    imo_number: Optional[str]
    status: Optional[str]


# ---------------- MAINTENANCE ----------------

class MaintenanceCreate(BaseModel):
    vessel_id: int
    component: str
    description: str
    maintenance_date: date
    status: str = "Pending"


class MaintenanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    record_id: int
    vessel_id: int
    component: Optional[str]
    description: Optional[str]
    maintenance_date: Optional[date]
    status: Optional[str]


# ---------------- INCIDENT ----------------

class IncidentCreate(BaseModel):
    vessel_id: int
    component: str
    description: str
    severity: str
    incident_date: date
    status: str = "Open"


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    incident_id: int
    vessel_id: int
    component: Optional[str]
    description: Optional[str]
    severity: Optional[str]
    incident_date: Optional[date]
    status: Optional[str]


# ---------------- INSPECTION ----------------

class InspectionCreate(BaseModel):
    vessel_id: int
    inspection_type: str
    inspection_date: date
    result: str


class InspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inspection_id: int
    vessel_id: int
    inspection_type: Optional[str]
    inspection_date: Optional[date]
    result: Optional[str]


# ---------------- REPAIR ----------------

class RepairCreate(BaseModel):
    vessel_id: int
    component: str
    repair_description: str
    repair_date: date
    status: str = "Completed"


class RepairResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    repair_id: int
    vessel_id: int
    component: Optional[str]
    repair_description: Optional[str]
    repair_date: Optional[date]
    status: Optional[str]


# ---------------- NOTIFICATION ----------------

class NotificationCreate(BaseModel):
    vessel_id: Optional[int] = None
    notification_type: str
    message: str


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    vessel_id: Optional[int]
    notification_type: str
    message: str
    is_read: bool
    created_at: datetime


# ---------------- ACTIVITY ----------------

class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_id: int
    action: str
    description: str
    vessel_id: Optional[int]
    created_at: datetime


# ---------------- AUTHENTICATION ----------------

class SuperAdminSetup(BaseModel):
    setup_key: str
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    created_by: Optional[int]
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CreateUserRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserStatusUpdate(BaseModel):
    is_active: bool


# =====================================================
# AUTHENTICATION APIs
# =====================================================

@app.post(
    "/auth/setup-super-admin",
    response_model=UserResponse
)
def setup_super_admin(
    data: SuperAdminSetup,
    db: Session = Depends(get_db)
):
    setup_key = os.getenv("FIRST_ADMIN_SETUP_KEY")

    if not setup_key or not hmac.compare_digest(
        data.setup_key,
        setup_key
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid setup key"
        )

    if db.query(models.User).count() > 0:
        raise HTTPException(
            status_code=403,
            detail="Super Admin has already been created"
        )

    user = models.User(
        full_name=data.full_name,
        email=data.email.lower(),
        password_hash=get_password_hash(data.password),
        role="SUPER_ADMIN",
        created_by=None,
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post(
    "/auth/login",
    response_model=TokenResponse
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.email == form_data.username.lower()
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account is inactive"
        )

    token = create_access_token(
        user.user_id,
        user.role
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@app.get(
    "/auth/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: models.User = Depends(get_current_user)
):
    return current_user


# ---------------- CREATE ADMIN ----------------

@app.post(
    "/auth/admins",
    response_model=UserResponse
)
def create_admin(
    data: CreateUserRequest,
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN")
    ),
    db: Session = Depends(get_db)
):
    email = data.email.lower()

    existing = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = models.User(
        full_name=data.full_name,
        email=email,
        password_hash=get_password_hash(data.password),
        role="ADMIN",
        created_by=current_user.user_id,
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ---------------- CREATE STAFF ----------------

@app.post(
    "/auth/staff",
    response_model=UserResponse
)
def create_staff(
    data: CreateUserRequest,
    current_user: models.User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db)
):
    email = data.email.lower()

    existing = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user = models.User(
        full_name=data.full_name,
        email=email,
        password_hash=get_password_hash(data.password),
        role="STAFF",
        created_by=current_user.user_id,
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ---------------- VIEW STAFF CREATED BY ADMIN ----------------

@app.get(
    "/auth/staff",
    response_model=list[UserResponse]
)
def get_my_staff(
    current_user: models.User = Depends(
        require_roles("ADMIN")
    ),
    db: Session = Depends(get_db)
):
    return db.query(models.User).filter(
        models.User.created_by == current_user.user_id,
        models.User.role == "STAFF"
    ).order_by(
        models.User.user_id.desc()
    ).all()


# ---------------- SUPER ADMIN VIEW ALL USERS ----------------

@app.get(
    "/auth/users",
    response_model=list[UserResponse]
)
def get_all_users(
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN")
    ),
    db: Session = Depends(get_db)
):
    return db.query(models.User).order_by(
        models.User.user_id.desc()
    ).all()


# ---------------- UPDATE ACCOUNT STATUS ----------------

@app.patch(
    "/auth/users/{user_id}/status",
    response_model=UserResponse
)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.user_id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own account status"
        )

    if current_user.role == "SUPER_ADMIN":
        if user.role == "SUPER_ADMIN":
            raise HTTPException(
                status_code=403,
                detail="Cannot modify another Super Admin account"
            )

    elif current_user.role == "ADMIN":
        if (
            user.role != "STAFF"
            or user.created_by != current_user.user_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You can only manage your own staff"
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions"
        )

    user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


# =====================================================
# BASIC APIs
# =====================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to SHIPMEM!",
        "status": "Backend Running Successfully"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/database-status")
def database_status():
    return {
        "database": "SQLite",
        "status": "Connected",
        "tables": [
            "users",
            "vessels",
            "maintenance",
            "incidents",
            "inspections",
            "repairs",
            "notifications",
            "activities"
        ]
    }


# =====================================================
# VESSEL MANAGEMENT
# =====================================================

@app.post(
    "/vessels",
    response_model=VesselResponse
)
def create_vessel(
    vessel: VesselCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    if vessel.imo_number:
        existing = db.query(models.Vessel).filter(
            models.Vessel.imo_number == vessel.imo_number
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Vessel with this IMO number already exists"
            )

    new_vessel = models.Vessel(
        vessel_name=vessel.vessel_name,
        vessel_type=vessel.vessel_type,
        imo_number=vessel.imo_number,
        status=vessel.status
    )

    db.add(new_vessel)
    db.commit()
    db.refresh(new_vessel)

    description = f"New vessel registered: {new_vessel.vessel_name}"

    activity_stack.push(description)
    log_activity(db, "Vessel Registered", description, new_vessel.vessel_id)

    create_notification(
        db,
        new_vessel.vessel_id,
        "Vessel",
        f"{new_vessel.vessel_name} has been registered successfully."
    )

    return new_vessel


@app.get(
    "/vessels",
    response_model=list[VesselResponse]
)
def get_vessels(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Vessel).order_by(
        models.Vessel.vessel_id.desc()
    ).all()


@app.get("/vessels/{vessel_id}/details")
def get_vessel_details(
    vessel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vessel = db.query(models.Vessel).filter(
        models.Vessel.vessel_id == vessel_id
    ).first()

    if not vessel:
        raise HTTPException(
            status_code=404,
            detail="Vessel not found"
        )

    return {
        "vessel": vessel,
        "maintenance": db.query(models.Maintenance).filter(
            models.Maintenance.vessel_id == vessel_id
        ).all(),
        "incidents": db.query(models.Incident).filter(
            models.Incident.vessel_id == vessel_id
        ).all(),
        "inspections": db.query(models.Inspection).filter(
            models.Inspection.vessel_id == vessel_id
        ).all(),
        "repairs": db.query(models.Repair).filter(
            models.Repair.vessel_id == vessel_id
        ).all()
    }


# =====================================================
# MAINTENANCE MANAGEMENT
# =====================================================

@app.post(
    "/maintenance",
    response_model=MaintenanceResponse
)
def create_maintenance(
    maintenance: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vessel = db.query(models.Vessel).filter(
        models.Vessel.vessel_id == maintenance.vessel_id
    ).first()

    if not vessel:
        raise HTTPException(
            status_code=404,
            detail="Vessel not found"
        )

    new_record = models.Maintenance(
        vessel_id=maintenance.vessel_id,
        component=maintenance.component,
        description=maintenance.description,
        maintenance_date=maintenance.maintenance_date,
        status=maintenance.status
    )

    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    description = (
        f"Maintenance recorded for {maintenance.component} "
        f"on {vessel.vessel_name}"
    )

    activity_stack.push(description)
    log_activity(db, "Maintenance Created", description, vessel.vessel_id)

    if maintenance.status.lower() == "pending":
        maintenance_queue.enqueue(
            f"{vessel.vessel_name}: {maintenance.component} - "
            f"{maintenance.description}"
        )

        create_notification(
            db,
            vessel.vessel_id,
            "Maintenance",
            f"Pending maintenance scheduled for {maintenance.component} "
            f"on {maintenance.maintenance_date}."
        )

    return new_record


@app.get(
    "/maintenance",
    response_model=list[MaintenanceResponse]
)
def get_maintenance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    maintenance_list = MaintenanceList()

    records = db.query(models.Maintenance).order_by(
        models.Maintenance.maintenance_date
    ).all()

    for record in records:
        maintenance_list.add_record({
            "record_id": record.record_id,
            "vessel_id": record.vessel_id,
            "component": record.component,
            "description": record.description,
            "maintenance_date": record.maintenance_date,
            "status": record.status
        })

    return maintenance_list.get_records()


# =====================================================
# INCIDENT MANAGEMENT
# =====================================================

@app.post(
    "/incidents",
    response_model=IncidentResponse
)
def create_incident(
    incident: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vessel = db.query(models.Vessel).filter(
        models.Vessel.vessel_id == incident.vessel_id
    ).first()

    if not vessel:
        raise HTTPException(
            status_code=404,
            detail="Vessel not found"
        )

    new_incident = models.Incident(
        vessel_id=incident.vessel_id,
        component=incident.component,
        description=incident.description,
        severity=incident.severity,
        incident_date=incident.incident_date,
        status=incident.status
    )

    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    description = (
        f"Incident reported: {incident.component} - {incident.severity}"
    )

    activity_stack.push(description)
    log_activity(db, "Incident Reported", description, vessel.vessel_id)

    create_notification(
        db,
        vessel.vessel_id,
        "Incident",
        f"{incident.severity} severity incident reported for "
        f"{incident.component} on {vessel.vessel_name}."
    )

    return new_incident


@app.get(
    "/incidents",
    response_model=list[IncidentResponse]
)
def get_incidents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Incident).order_by(
        models.Incident.incident_date.desc()
    ).all()


# =====================================================
# INSPECTION MANAGEMENT
# =====================================================

@app.post(
    "/inspections",
    response_model=InspectionResponse
)
def create_inspection(
    inspection: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    vessel = db.query(models.Vessel).filter(
        models.Vessel.vessel_id == inspection.vessel_id
    ).first()

    if not vessel:
        raise HTTPException(
            status_code=404,
            detail="Vessel not found"
        )

    new_inspection = models.Inspection(
        vessel_id=inspection.vessel_id,
        inspection_type=inspection.inspection_type,
        inspection_date=inspection.inspection_date,
        result=inspection.result
    )

    db.add(new_inspection)
    db.commit()
    db.refresh(new_inspection)

    description = f"Inspection completed: {inspection.inspection_type}"

    activity_stack.push(description)
    log_activity(db, "Inspection Completed", description, vessel.vessel_id)

    create_notification(
        db,
        vessel.vessel_id,
        "Inspection",
        f"{inspection.inspection_type} inspection recorded for "
        f"{vessel.vessel_name}."
    )

    return new_inspection


@app.get(
    "/inspections",
    response_model=list[InspectionResponse]
)
def get_inspections(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Inspection).order_by(
        models.Inspection.inspection_date.desc()
    ).all()


# =====================================================
# REPAIR MANAGEMENT
# =====================================================

@app.post(
    "/repairs",
    response_model=RepairResponse
)
def create_repair(
    repair: RepairCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    vessel = db.query(models.Vessel).filter(
        models.Vessel.vessel_id == repair.vessel_id
    ).first()

    if not vessel:
        raise HTTPException(
            status_code=404,
            detail="Vessel not found"
        )

    new_repair = models.Repair(
        vessel_id=repair.vessel_id,
        component=repair.component,
        repair_description=repair.repair_description,
        repair_date=repair.repair_date,
        status=repair.status
    )

    db.add(new_repair)
    db.commit()
    db.refresh(new_repair)

    description = f"Repair recorded: {repair.component}"

    activity_stack.push(description)
    log_activity(db, "Repair Recorded", description, vessel.vessel_id)

    create_notification(
        db,
        vessel.vessel_id,
        "Repair",
        f"Repair recorded for {repair.component} on {vessel.vessel_name}."
    )

    return new_repair


@app.get(
    "/repairs",
    response_model=list[RepairResponse]
)
def get_repairs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Repair).order_by(
        models.Repair.repair_date.desc()
    ).all()


# =====================================================
# ACTIVITY HISTORY
# =====================================================

@app.post("/activities")
def add_activity(
    activity: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    activity_stack.push(activity)

    log_activity(
        db,
        "Activity Added",
        activity
    )

    return {
        "message": "Activity added successfully",
        "latest_activity": activity_stack.peek()
    }


@app.get("/activities")
def get_activities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if activity_stack.is_empty():
        db_activities = db.query(models.Activity).order_by(
            models.Activity.created_at.asc()
        ).all()
        for act in db_activities:
            activity_stack.push(f"{act.action}: {act.description}")

    return {
        "activities": activity_stack.get_activities()
    }


@app.get(
    "/activity-history",
    response_model=list[ActivityResponse]
)
def get_activity_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Activity).order_by(
        models.Activity.created_at.desc()
    ).all()


@app.delete("/activities/latest")
def remove_latest_activity(
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    activity = activity_stack.pop()

    if activity is None:
        raise HTTPException(
            status_code=404,
            detail="No activities available"
        )

    return {
        "message": "Latest activity removed",
        "removed_activity": activity
    }


# =====================================================
# MAINTENANCE QUEUE
# =====================================================

@app.post("/maintenance-queue")
def add_maintenance_task(
    task: str,
    current_user: models.User = Depends(get_current_user)
):
    maintenance_queue.enqueue(task)

    return {
        "message": "Task added successfully",
        "task": task
    }


@app.get("/maintenance-queue")
def get_maintenance_tasks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if maintenance_queue.is_empty():
        pending_maint = db.query(models.Maintenance).filter(
            models.Maintenance.status.ilike("%pending%")
        ).all()
        for m in pending_maint:
            vessel = db.query(models.Vessel).filter(
                models.Vessel.vessel_id == m.vessel_id
            ).first()
            v_name = vessel.vessel_name if vessel else f"Vessel #{m.vessel_id}"
            maintenance_queue.enqueue(
                f"{v_name}: {m.component} - {m.description}"
            )

    return {
        "tasks": maintenance_queue.get_tasks()
    }


@app.delete("/maintenance-queue/next")
def complete_maintenance_task(
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    task = maintenance_queue.dequeue()

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="No pending tasks available"
        )

    return {
        "message": "Task removed successfully",
        "completed_task": task
    }


# =====================================================
# MAINTENANCE CALENDAR
# =====================================================

@app.get("/calendar")
def get_calendar_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    events = []

    maintenance_records = db.query(models.Maintenance).all()

    for record in maintenance_records:
        vessel = db.query(models.Vessel).filter(
            models.Vessel.vessel_id == record.vessel_id
        ).first()

        events.append({
            "id": f"maintenance-{record.record_id}",
            "title": f"Maintenance: {record.component}",
            "date": (
                record.maintenance_date.isoformat()
                if record.maintenance_date else None
            ),
            "type": "Maintenance",
            "status": record.status,
            "vessel_id": record.vessel_id,
            "vessel_name": vessel.vessel_name if vessel else "Unknown"
        })

    inspection_records = db.query(models.Inspection).all()

    for record in inspection_records:
        vessel = db.query(models.Vessel).filter(
            models.Vessel.vessel_id == record.vessel_id
        ).first()

        events.append({
            "id": f"inspection-{record.inspection_id}",
            "title": f"Inspection: {record.inspection_type}",
            "date": (
                record.inspection_date.isoformat()
                if record.inspection_date else None
            ),
            "type": "Inspection",
            "status": record.result,
            "vessel_id": record.vessel_id,
            "vessel_name": vessel.vessel_name if vessel else "Unknown"
        })

    return events


# =====================================================
# COMPONENT TREE & KNOWLEDGE GRAPH HELPERS
# =====================================================

def generate_knowledge_graph_data(db: Session):
    vessels = db.query(models.Vessel).all()
    maintenances = db.query(models.Maintenance).all()
    incidents = db.query(models.Incident).all()
    repairs = db.query(models.Repair).all()
    inspections = db.query(models.Inspection).all()

    vessel_map = {v.vessel_id: v.vessel_name for v in vessels}
    nodes = []
    edges = []
    adjacency = {}

    def add_n(n_id, n_type, label, v_id, meta):
        if not any(n["id"] == n_id for n in nodes):
            nodes.append({
                "id": n_id,
                "type": n_type,
                "label": label,
                "vessel_id": v_id,
                "metadata": meta
            })
            if n_id not in adjacency:
                adjacency[n_id] = []

    def add_e(src, tgt, rel, lbl=None):
        e_id = f"{src}-{rel}-{tgt}"
        if not any(e["id"] == e_id for e in edges):
            edges.append({
                "id": e_id,
                "source": src,
                "target": tgt,
                "relationship": rel,
                "label": lbl or rel
            })
            if src in adjacency and tgt not in adjacency[src]:
                adjacency[src].append(tgt)
            if tgt in adjacency and src not in adjacency[tgt]:
                adjacency[tgt].append(src)

    # 1. Vessels
    for v in vessels:
        add_n(f"vessel-{v.vessel_id}", "vessel", v.vessel_name, v.vessel_id, {
            "vessel_id": v.vessel_id,
            "vessel_name": v.vessel_name,
            "vessel_type": v.vessel_type,
            "imo_number": v.imo_number,
            "status": v.status
        })

    # 2. Components
    comp_dict = {}
    for item in list(maintenances) + list(incidents) + list(repairs):
        if item.component and item.vessel_id:
            raw = item.component.strip()
            norm = raw.lower()
            key = (item.vessel_id, norm)
            if key not in comp_dict:
                comp_dict[key] = raw

    for (v_id, norm), canonical in comp_dict.items():
        c_id = f"comp-{v_id}-{norm.replace(' ', '-')}"
        add_n(c_id, "component", canonical, v_id, {
            "component_name": canonical,
            "vessel_id": v_id,
            "vessel_name": vessel_map.get(v_id, "Unknown")
        })
        # Vessel -> contains -> Component
        add_e(f"vessel-{v_id}", c_id, "contains", "contains")
        # Component -> belongs to -> Vessel
        add_e(c_id, f"vessel-{v_id}", "belongs to", "belongs to")

    # 3. Maintenance Records
    for m in maintenances:
        m_id = f"maint-{m.record_id}"
        add_n(m_id, "maintenance", f"Maint #{m.record_id}: {m.component or 'General'}", m.vessel_id, {
            "record_id": m.record_id,
            "component": m.component,
            "description": m.description,
            "maintenance_date": str(m.maintenance_date) if m.maintenance_date else None,
            "status": m.status,
            "vessel_name": vessel_map.get(m.vessel_id, "Unknown")
        })
        if m.component and m.vessel_id:
            c_key = (m.vessel_id, m.component.strip().lower())
            if c_key in comp_dict:
                c_id = f"comp-{m.vessel_id}-{c_key[1].replace(' ', '-')}"
                # Component -> has maintenance history -> Maintenance
                add_e(c_id, m_id, "has maintenance history", "has maintenance history")
                # Maintenance Record -> relates to -> Component
                add_e(m_id, c_id, "relates to", "relates to")
        elif m.vessel_id:
            add_e(f"vessel-{m.vessel_id}", m_id, "has maintenance", "has maintenance")

    # 4. Incidents
    for inc in incidents:
        inc_id = f"incident-{inc.incident_id}"
        add_n(inc_id, "incident", f"Incident #{inc.incident_id}: {inc.component or 'General'}", inc.vessel_id, {
            "incident_id": inc.incident_id,
            "component": inc.component,
            "description": inc.description,
            "severity": inc.severity,
            "incident_date": str(inc.incident_date) if inc.incident_date else None,
            "status": inc.status,
            "vessel_name": vessel_map.get(inc.vessel_id, "Unknown")
        })
        if inc.vessel_id:
            # Incident -> affects -> Vessel
            add_e(inc_id, f"vessel-{inc.vessel_id}", "affects", "affects")
        if inc.component and inc.vessel_id:
            c_key = (inc.vessel_id, inc.component.strip().lower())
            if c_key in comp_dict:
                c_id = f"comp-{inc.vessel_id}-{c_key[1].replace(' ', '-')}"
                # Incident -> involves -> Component
                add_e(inc_id, c_id, "involves", "involves")

    # 5. Repairs
    for r in repairs:
        r_id = f"repair-{r.repair_id}"
        add_n(r_id, "repair", f"Repair #{r.repair_id}: {r.component or 'General'}", r.vessel_id, {
            "repair_id": r.repair_id,
            "component": r.component,
            "repair_description": r.repair_description,
            "repair_date": str(r.repair_date) if r.repair_date else None,
            "status": r.status,
            "vessel_name": vessel_map.get(r.vessel_id, "Unknown")
        })
        if r.vessel_id:
            # Repair -> affects -> Vessel
            add_e(r_id, f"vessel-{r.vessel_id}", "affects", "affects")
        if r.component and r.vessel_id:
            c_key = (r.vessel_id, r.component.strip().lower())
            if c_key in comp_dict:
                c_id = f"comp-{r.vessel_id}-{c_key[1].replace(' ', '-')}"
                # Component -> has repair history -> Repair
                add_e(c_id, r_id, "has repair history", "has repair history")
                # Repair -> relates to -> Component
                add_e(r_id, c_id, "relates to", "relates to")

    # 6. Inspections
    for ins in inspections:
        ins_id = f"insp-{ins.inspection_id}"
        add_n(ins_id, "inspection", f"Inspection #{ins.inspection_id}: {ins.inspection_type}", ins.vessel_id, {
            "inspection_id": ins.inspection_id,
            "inspection_type": ins.inspection_type,
            "inspection_date": str(ins.inspection_date) if ins.inspection_date else None,
            "result": ins.result,
            "vessel_name": vessel_map.get(ins.vessel_id, "Unknown")
        })
        if ins.vessel_id:
            # Inspection -> examines -> Vessel
            add_e(ins_id, f"vessel-{ins.vessel_id}", "examines", "examines")
            # If inspection mentions component keyword
            for (v_id, norm), canonical in comp_dict.items():
                if v_id == ins.vessel_id and ins.result:
                    lower_res = ins.result.lower()
                    words = [w for w in norm.split() if len(w) > 3]
                    if norm in lower_res or any(w in lower_res for w in words):
                        c_id = f"comp-{v_id}-{norm.replace(' ', '-')}"
                        # Inspection -> examines -> Component
                        add_e(ins_id, c_id, "examines", "examines")

    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "by_type": {}
    }
    for n in nodes:
        stats["by_type"][n["type"]] = stats["by_type"].get(n["type"], 0) + 1

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": stats,
        "adjacency": adjacency
    }


def sync_operational_graph_from_db(db: Session):
    vessels = db.query(models.Vessel).all()
    maintenances = db.query(models.Maintenance).all()
    incidents = db.query(models.Incident).all()
    repairs = db.query(models.Repair).all()
    inspections = db.query(models.Inspection).all()

    vessel_map = {v.vessel_id: v.vessel_name for v in vessels}

    for v in vessels:
        operational_graph.add_node(v.vessel_name)
        operational_graph.add_node(f"vessel-{v.vessel_id}")

    for m in maintenances:
        v_name = vessel_map.get(m.vessel_id)
        if v_name and m.component:
            operational_graph.add_connection(v_name, m.component)
            operational_graph.add_connection(
                m.component,
                f"Maint #{m.record_id}: {m.component}"
            )
            operational_graph.add_connection(
                f"vessel-{m.vessel_id}",
                f"comp-{m.vessel_id}-{m.component.strip().lower().replace(' ', '-')}"
            )
            operational_graph.add_connection(
                f"comp-{m.vessel_id}-{m.component.strip().lower().replace(' ', '-')}",
                f"maint-{m.record_id}"
            )

    for inc in incidents:
        v_name = vessel_map.get(inc.vessel_id)
        if v_name and inc.component:
            operational_graph.add_connection(v_name, inc.component)
            operational_graph.add_connection(
                inc.component,
                f"Incident #{inc.incident_id}: {inc.component}"
            )
            operational_graph.add_connection(
                f"vessel-{inc.vessel_id}",
                f"comp-{inc.vessel_id}-{inc.component.strip().lower().replace(' ', '-')}"
            )
            operational_graph.add_connection(
                f"comp-{inc.vessel_id}-{inc.component.strip().lower().replace(' ', '-')}",
                f"incident-{inc.incident_id}"
            )

    for r in repairs:
        v_name = vessel_map.get(r.vessel_id)
        if v_name and r.component:
            operational_graph.add_connection(v_name, r.component)
            operational_graph.add_connection(
                r.component,
                f"Repair #{r.repair_id}: {r.component}"
            )
            operational_graph.add_connection(
                f"vessel-{r.vessel_id}",
                f"comp-{r.vessel_id}-{r.component.strip().lower().replace(' ', '-')}"
            )
            operational_graph.add_connection(
                f"comp-{r.vessel_id}-{r.component.strip().lower().replace(' ', '-')}",
                f"repair-{r.repair_id}"
            )

    for ins in inspections:
        v_name = vessel_map.get(ins.vessel_id)
        if v_name:
            operational_graph.add_connection(
                v_name,
                f"Inspection #{ins.inspection_id}: {ins.inspection_type}"
            )
            operational_graph.add_connection(
                f"vessel-{ins.vessel_id}",
                f"insp-{ins.inspection_id}"
            )


def build_component_tree_data(db: Session, vessel_id: Optional[int] = None):
    vessels = db.query(models.Vessel).all()
    if not vessels:
        return {"name": "No Vessels Available", "children": []}

    target_vessel = None
    if vessel_id is not None:
        target_vessel = next((v for v in vessels if v.vessel_id == vessel_id), None)
    if not target_vessel:
        target_vessel = next((v for v in vessels if v.vessel_name == "Ocean Star"), vessels[0])

    m_list = db.query(models.Maintenance).filter_by(vessel_id=target_vessel.vessel_id).all()
    inc_list = db.query(models.Incident).filter_by(vessel_id=target_vessel.vessel_id).all()
    rep_list = db.query(models.Repair).filter_by(vessel_id=target_vessel.vessel_id).all()

    comp_map = {}
    for item in list(m_list) + list(inc_list) + list(rep_list):
        if item.component:
            raw = item.component.strip()
            norm = raw.lower()
            if norm not in comp_map:
                comp_map[norm] = raw

    component_nodes = []
    for norm, canonical in sorted(comp_map.items()):
        comp_node = {
            "name": canonical,
            "type": "component",
            "id": f"comp-{target_vessel.vessel_id}-{norm.replace(' ', '-')}",
            "metadata": {
                "component_name": canonical,
                "vessel_id": target_vessel.vessel_id,
                "vessel_name": target_vessel.vessel_name
            },
            "children": []
        }

        # Maintenance records under this component
        for m in m_list:
            if m.component and m.component.strip().lower() == norm:
                comp_node["children"].append({
                    "name": f"Maintenance #{m.record_id}: {m.description}",
                    "type": "maintenance",
                    "id": f"maint-{m.record_id}",
                    "metadata": {
                        "record_id": m.record_id,
                        "component": m.component,
                        "description": m.description,
                        "status": m.status,
                        "date": str(m.maintenance_date) if m.maintenance_date else None
                    },
                    "children": []
                })

        # Incidents under this component
        for inc in inc_list:
            if inc.component and inc.component.strip().lower() == norm:
                comp_node["children"].append({
                    "name": f"Incident #{inc.incident_id}: {inc.description or inc.severity}",
                    "type": "incident",
                    "id": f"incident-{inc.incident_id}",
                    "metadata": {
                        "incident_id": inc.incident_id,
                        "component": inc.component,
                        "severity": inc.severity,
                        "status": inc.status,
                        "date": str(inc.incident_date) if inc.incident_date else None
                    },
                    "children": []
                })

        # Repairs under this component
        for r in rep_list:
            if r.component and r.component.strip().lower() == norm:
                comp_node["children"].append({
                    "name": f"Repair #{r.repair_id}: {r.repair_description or r.status}",
                    "type": "repair",
                    "id": f"repair-{r.repair_id}",
                    "metadata": {
                        "repair_id": r.repair_id,
                        "component": r.component,
                        "description": r.repair_description,
                        "status": r.status,
                        "date": str(r.repair_date) if r.repair_date else None
                    },
                    "children": []
                })

        component_nodes.append(comp_node)

    # Merge any dynamic children added to in-memory component_tree
    try:
        in_memory_tree = component_tree.display_tree()
        for mem_child in in_memory_tree.get("children", []):
            mem_name = mem_child.get("name")
            if mem_name and not any(c["name"].lower() == mem_name.lower() for c in component_nodes):
                component_nodes.append(mem_child)
    except Exception:
        pass

    root = {
        "name": target_vessel.vessel_name,
        "type": "vessel",
        "id": f"vessel-{target_vessel.vessel_id}",
        "metadata": {
            "vessel_id": target_vessel.vessel_id,
            "vessel_name": target_vessel.vessel_name,
            "imo_number": target_vessel.imo_number,
            "vessel_type": target_vessel.vessel_type,
            "status": target_vessel.status
        },
        "children": component_nodes
    }

    return root


# =====================================================
# COMPONENT TREE ENDPOINTS
# =====================================================

@app.post("/components")
def add_component(
    parent_name: str,
    component_name: str,
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    success = component_tree.add_component(
        parent_name,
        component_name
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Parent component not found"
        )

    return {
        "message": "Component added successfully",
        "component": component_name,
        "parent": parent_name
    }


@app.get("/components/tree")
def get_component_tree(
    vessel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return build_component_tree_data(db, vessel_id=vessel_id)


# =====================================================
# KNOWLEDGE GRAPH & OPERATIONAL GRAPH ENDPOINTS
# =====================================================

@app.get("/knowledge-graph")
def get_knowledge_graph_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sync_operational_graph_from_db(db)
    return generate_knowledge_graph_data(db)


@app.post("/graph/connections")
def add_graph_connection(
    node1: str,
    node2: str,
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    operational_graph.add_connection(node1, node2)

    return {
        "message": "Connection added successfully",
        "node1": node1,
        "node2": node2
    }


@app.get("/graph")
def get_operational_graph(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sync_operational_graph_from_db(db)
    return operational_graph.get_graph()


@app.get("/graph/bfs")
def graph_bfs(
    start: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sync_operational_graph_from_db(db)

    start_node = start
    if start_node not in operational_graph.graph:
        matched = next(
            (k for k in operational_graph.graph if k.lower() == start.lower()),
            None
        )
        if matched:
            start_node = matched
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Starting node '{start}' not found"
            )

    result = operational_graph.bfs(start_node)

    return {
        "traversal": "BFS",
        "start": start_node,
        "result": result
    }


@app.get("/graph/dfs")
def graph_dfs(
    start: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sync_operational_graph_from_db(db)

    start_node = start
    if start_node not in operational_graph.graph:
        matched = next(
            (k for k in operational_graph.graph if k.lower() == start.lower()),
            None
        )
        if matched:
            start_node = matched
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Starting node '{start}' not found"
            )

    result = operational_graph.dfs(start_node)

    return {
        "traversal": "DFS",
        "start": start_node,
        "result": result
    }


# =====================================================
# NOTIFICATION CENTRE
# =====================================================

@app.post(
    "/notifications",
    response_model=NotificationResponse
)
def add_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    if notification.vessel_id is not None:
        vessel = db.query(models.Vessel).filter(
            models.Vessel.vessel_id == notification.vessel_id
        ).first()

        if not vessel:
            raise HTTPException(
                status_code=404,
                detail="Vessel not found"
            )

    new_notification = models.Notification(
        vessel_id=notification.vessel_id,
        notification_type=notification.notification_type,
        message=notification.message
    )

    db.add(new_notification)
    db.commit()
    db.refresh(new_notification)

    return new_notification


@app.get(
    "/notifications",
    response_model=list[NotificationResponse]
)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Notification).order_by(
        models.Notification.created_at.desc()
    ).all()


@app.get(
    "/notifications/unread",
    response_model=list[NotificationResponse]
)
def get_unread_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Notification).filter(
        models.Notification.is_read == False
    ).order_by(
        models.Notification.created_at.desc()
    ).all()


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    notification = db.query(models.Notification).filter(
        models.Notification.notification_id == notification_id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    notification.is_read = True
    db.commit()

    return {
        "message": "Notification marked as read"
    }


@app.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles("SUPER_ADMIN", "ADMIN")
    )
):
    notification = db.query(models.Notification).filter(
        models.Notification.notification_id == notification_id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    db.delete(notification)
    db.commit()

    return {
        "message": "Notification deleted successfully"
    }