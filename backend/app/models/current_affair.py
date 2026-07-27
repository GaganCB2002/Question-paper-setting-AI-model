from sqlalchemy import Column, String, Text, ForeignKey, Integer, Date, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class CurrentAffair(Base, TimestampMixin):
    __tablename__ = "current_affairs"

    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)
    sub_category = Column(String(100), nullable=True)
    event_date = Column(Date, nullable=True, index=True)
    month = Column(String(20), nullable=True, index=True)
    year = Column(Integer, nullable=True, index=True)
    location = Column(String(300), nullable=True)
    state = Column(String(100), nullable=True, index=True)
    is_karnataka_specific = Column(Boolean, default=False, nullable=False)
    is_national = Column(Boolean, default=True, nullable=False)
    is_international = Column(Boolean, default=False, nullable=False)
    source = Column(String(500), nullable=True)
    source_url = Column(String(1000), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_source = Column(String(500), nullable=True)
    tags = Column(String(500), nullable=True)
    language = Column(String(50), nullable=True)
    image_url = Column(String(1000), nullable=True)
    importance = Column(String(20), default="medium", nullable=False)
    is_government_scheme_related = Column(Boolean, default=False, nullable=False)
    government_scheme_id = Column(Uuid, ForeignKey("government_schemes.id"), nullable=True)

    government_scheme = relationship("GovernmentScheme", back_populates="current_affairs")


class GovernmentScheme(Base, TimestampMixin):
    __tablename__ = "government_schemes"

    name = Column(String(500), nullable=False, index=True)
    short_name = Column(String(100), nullable=True, index=True)
    scheme_type = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    benefits = Column(Text, nullable=True)
    eligibility = Column(Text, nullable=True)
    application_process = Column(Text, nullable=True)
    implementing_ministry = Column(String(300), nullable=True)
    implementing_department = Column(String(300), nullable=True)
    state = Column(String(100), nullable=True, index=True)
    is_karnataka_scheme = Column(Boolean, default=False, nullable=False)
    is_central_scheme = Column(Boolean, default=False, nullable=False)
    launch_date = Column(Date, nullable=True)
    launch_year = Column(Integer, nullable=True, index=True)
    budget_allocation = Column(String(100), nullable=True)
    official_website = Column(String(500), nullable=True)
    official_notification = Column(String(500), nullable=True)
    source = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_source = Column(String(500), nullable=True)
    tags = Column(String(500), nullable=True)
    language = Column(String(50), nullable=True)
    key_features_json = Column(Text, nullable=True)
    statistics_json = Column(Text, nullable=True)

    current_affairs = relationship("CurrentAffair", back_populates="government_scheme")
