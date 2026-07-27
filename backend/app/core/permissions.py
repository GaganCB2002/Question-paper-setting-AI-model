from enum import Enum


class RoleEnum(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    STUDENT = "student"


class PermissionEnum(str, Enum):
    # User Management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"

    # File Management
    FILE_UPLOAD = "file:upload"
    FILE_READ = "file:read"
    FILE_DELETE = "file:delete"
    FILE_PROCESS = "file:process"

    # Syllabus Management
    SYLLABUS_CREATE = "syllabus:create"
    SYLLABUS_READ = "syllabus:read"
    SYLLABUS_UPDATE = "syllabus:update"
    SYLLABUS_DELETE = "syllabus:delete"

    # Question Management
    QUESTION_CREATE = "question:create"
    QUESTION_READ = "question:read"
    QUESTION_UPDATE = "question:update"
    QUESTION_DELETE = "question:delete"

    # Paper Generation
    PAPER_GENERATE = "paper:generate"
    PAPER_READ = "paper:read"
    PAPER_UPDATE = "paper:update"
    PAPER_DELETE = "paper:delete"
    PAPER_PUBLISH = "paper:publish"

    # AI Job Management
    JOB_CREATE = "job:create"
    JOB_READ = "job:read"
    JOB_CANCEL = "job:cancel"

    # Settings Management
    SETTINGS_READ = "settings:read"
    SETTINGS_UPDATE = "settings:update"

    # User Management (Admin)
    USER_MANAGE = "user:manage"
    ROLE_MANAGE = "role:manage"

    # Audit
    AUDIT_READ = "audit:read"

    # PDF Reader
    PDF_NOTE_CREATE = "pdf_note:create"
    PDF_NOTE_READ = "pdf_note:read"
    PDF_NOTE_DELETE = "pdf_note:delete"


ROLE_PERMISSIONS: dict[RoleEnum, list[PermissionEnum]] = {
    RoleEnum.ADMIN: [
        PermissionEnum.USER_CREATE,
        PermissionEnum.USER_READ,
        PermissionEnum.USER_UPDATE,
        PermissionEnum.USER_DELETE,
        PermissionEnum.FILE_UPLOAD,
        PermissionEnum.FILE_READ,
        PermissionEnum.FILE_DELETE,
        PermissionEnum.FILE_PROCESS,
        PermissionEnum.SYLLABUS_CREATE,
        PermissionEnum.SYLLABUS_READ,
        PermissionEnum.SYLLABUS_UPDATE,
        PermissionEnum.SYLLABUS_DELETE,
        PermissionEnum.QUESTION_CREATE,
        PermissionEnum.QUESTION_READ,
        PermissionEnum.QUESTION_UPDATE,
        PermissionEnum.QUESTION_DELETE,
        PermissionEnum.PAPER_GENERATE,
        PermissionEnum.PAPER_READ,
        PermissionEnum.PAPER_UPDATE,
        PermissionEnum.PAPER_DELETE,
        PermissionEnum.PAPER_PUBLISH,
        PermissionEnum.JOB_CREATE,
        PermissionEnum.JOB_READ,
        PermissionEnum.JOB_CANCEL,
        PermissionEnum.SETTINGS_READ,
        PermissionEnum.SETTINGS_UPDATE,
        PermissionEnum.USER_MANAGE,
        PermissionEnum.ROLE_MANAGE,
        PermissionEnum.AUDIT_READ,
        PermissionEnum.PDF_NOTE_CREATE,
        PermissionEnum.PDF_NOTE_READ,
        PermissionEnum.PDF_NOTE_DELETE,
    ],
    RoleEnum.EDITOR: [
        PermissionEnum.USER_READ,
        PermissionEnum.FILE_UPLOAD,
        PermissionEnum.FILE_READ,
        PermissionEnum.FILE_PROCESS,
        PermissionEnum.SYLLABUS_CREATE,
        PermissionEnum.SYLLABUS_READ,
        PermissionEnum.SYLLABUS_UPDATE,
        PermissionEnum.QUESTION_CREATE,
        PermissionEnum.QUESTION_READ,
        PermissionEnum.QUESTION_UPDATE,
        PermissionEnum.QUESTION_DELETE,
        PermissionEnum.PAPER_GENERATE,
        PermissionEnum.PAPER_READ,
        PermissionEnum.PAPER_UPDATE,
        PermissionEnum.PAPER_DELETE,
        PermissionEnum.JOB_CREATE,
        PermissionEnum.JOB_READ,
        PermissionEnum.JOB_CANCEL,
        PermissionEnum.PDF_NOTE_CREATE,
        PermissionEnum.PDF_NOTE_READ,
        PermissionEnum.PDF_NOTE_DELETE,
    ],
    RoleEnum.STUDENT: [
        PermissionEnum.FILE_READ,
        PermissionEnum.QUESTION_READ,
        PermissionEnum.PAPER_READ,
        PermissionEnum.JOB_READ,
        PermissionEnum.PDF_NOTE_CREATE,
        PermissionEnum.PDF_NOTE_READ,
        PermissionEnum.PDF_NOTE_DELETE,
    ],
}
