from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
