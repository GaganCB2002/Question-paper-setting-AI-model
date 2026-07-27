from app.models.base import Base, TimestampMixin
from app.models.user import User, Role, Permission, RolePermission
from app.models.uploaded_file import UploadedFile
from app.models.syllabus import Syllabus, Topic, SubTopic
from app.models.exam_pattern import ExamPattern
from app.models.question import PreviousYearQuestion, QuestionBank, GeneratedPaper, GeneratedQuestion
from app.models.answer_key import AnswerKey, Explanation
from app.models.current_affair import CurrentAffair, GovernmentScheme
from app.models.ocr_data import OCRData, Image
from app.models.ai_job import AIJob, PromptTemplate
from app.models.log import AuditLog, ActivityLog
from app.models.setting import Setting
from app.models.pdf_note import PDFNote, PDFBookmark, PDFAnnotation
from app.models.folder import Folder
from app.models.token_quota import TokenQuota, TokenUsageLog
from app.models.generation_task import GenerationTask, TaskPhase, TaskApproval
