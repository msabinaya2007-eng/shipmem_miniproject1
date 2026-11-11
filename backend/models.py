from sqlalchemy import (
    Column, Integer, String, Float, Date, ForeignKey,
    Boolean, DateTime, Text
)
from datetime import datetime
from database import Base


# =========================
# USER MODEL
# =========================

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    # SUPER_ADMIN, ADMIN or STAFF
    role = Column(String(20), nullable=False)

    # Identifies who created this account
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# =========================
# VESSEL MODEL
# =========================

class Vessel(Base):
    __tablename__ = "vessels"

    vessel_id = Column(Integer, primary_key=True, index=True)
    vessel_name = Column(String(100), nullable=False)
    vessel_type = Column(String(50))
    imo_number = Column(String(20), unique=True)
    status = Column(String(30))


# =========================
# MAINTENANCE MODEL
# =========================

class Maintenance(Base):
    __tablename__ = "maintenance"

    record_id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.vessel_id"))
    component = Column(String(100))
    description = Column(String(500))
    maintenance_date = Column(Date)
    status = Column(String(30))


# =========================
# INCIDENT MODEL
# =========================

class Incident(Base):
    __tablename__ = "incidents"

    incident_id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.vessel_id"))
    component = Column(String(100))
    description = Column(String(500))
    severity = Column(String(30))
    incident_date = Column(Date)
    status = Column(String(30))


# =========================
# INSPECTION MODEL
# =========================

class Inspection(Base):
    __tablename__ = "inspections"

    inspection_id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.vessel_id"))
    inspection_type = Column(String(100))
    inspection_date = Column(Date)
    result = Column(String(500))


# =========================
# REPAIR MODEL
# =========================

class Repair(Base):
    __tablename__ = "repairs"

    repair_id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.vessel_id"))
    component = Column(String(100))
    repair_description = Column(String(500))
    repair_date = Column(Date)
    status = Column(String(30))


# =========================
# NOTIFICATION MODEL
# =========================

class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(
        Integer,
        ForeignKey("vessels.vessel_id"),
        nullable=True
    )
    notification_type = Column(String(50), nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# =========================
# ACTIVITY MODEL
# =========================

class Activity(Base):
    __tablename__ = "activities"

    activity_id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    vessel_id = Column(
        Integer,
        ForeignKey("vessels.vessel_id"),
        nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)