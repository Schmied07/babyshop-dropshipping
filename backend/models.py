"""Pydantic models & MongoDB helpers for MarcherBien Dropship."""
from datetime import datetime, timezone
from typing import Annotated, Any, Optional, List
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, EmailStr


def _coerce_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str) and ObjectId.is_valid(v):
        return v
    if v is None:
        return v
    raise ValueError(f"Invalid ObjectId: {v}")


PyObjectId = Annotated[str, BeforeValidator(_coerce_object_id)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BaseDocument(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
    )
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: Optional[dict]):
        if not doc:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls(**doc)

    def to_mongo(self, exclude_id: bool = True) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        if exclude_id and "_id" in data:
            data.pop("_id")
        return data


# ---------- User / Auth ----------
class User(BaseDocument):
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    role: str = "admin"  # admin | operator
    created_at: datetime = Field(default_factory=utc_now)


class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str


# ---------- Suppliers ----------
class LeadTime(BaseModel):
    min: int = 3
    max: int = 5
    unit: str = "days"


class Shipping(BaseModel):
    countries: List[str] = []
    freeShippingAbove: float = 0
    costPerKg: float = 0
    estimatedDays: int = 3


class Supplier(BaseDocument):
    name: str
    country: str
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    minOrderValue: float = 0
    leadTime: LeadTime = Field(default_factory=LeadTime)
    shipping: Shipping = Field(default_factory=Shipping)
    paymentMethods: List[str] = []
    supportedCurrencies: List[str] = ["EUR"]
    catalogUrl: Optional[str] = None
    isActive: bool = True
    rating: float = 0
    reviews: int = 0
    lastUpdated: datetime = Field(default_factory=utc_now)


# ---------- Products ----------
class Product(BaseDocument):
    sku: str
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    ageRange: Optional[str] = None
    images: List[str] = []
    isActive: bool = True
    # aggregated
    costPrice: float = 0  # best supplier cost
    retailPrice: float = 0  # computed from pricing rule
    stock: int = 0
    createdAt: datetime = Field(default_factory=utc_now)


class ProductVariant(BaseDocument):
    productId: str
    sku: str
    name: str
    attributes: List[dict] = []
    costPrice: float = 0
    wholeSalePrice: float = 0
    recommendedRetailPrice: float = 0
    stock: int = 0


# ---------- Supplier Products (mapping) ----------
class Packaging(BaseModel):
    unit: str = "unit"
    quantity: int = 1


class SupplierProduct(BaseDocument):
    supplierId: str
    productId: str
    supplierSku: str
    supplierName: str
    costPrice: float
    stock: int = 0
    minOrder: int = 1
    moq: int = 1
    leadTime: LeadTime = Field(default_factory=LeadTime)
    packaging: Packaging = Field(default_factory=Packaging)
    available: bool = True
    priority: int = 0  # higher = preferred
    lastUpdated: datetime = Field(default_factory=utc_now)


# ---------- Pricing Rules ----------
class PricingRule(BaseDocument):
    name: str
    category: Optional[str] = None  # applies to category, or all if None
    supplierId: Optional[str] = None
    markupPercent: float = 200  # e.g. 200 = ×3 total
    roundingRule: str = "ends_99"  # ends_99, ends_00, nearest_10, none
    minMargin: float = 0
    priority: int = 0
    isActive: bool = True
    createdAt: datetime = Field(default_factory=utc_now)


# ---------- Product Mapping (WooCommerce) ----------
class ProductMapping(BaseDocument):
    internalProductId: str
    wpProductId: Optional[int] = None
    wpSku: Optional[str] = None
    wpStatus: str = "draft"
    wpPrice: float = 0
    wpStock: int = 0
    syncedAt: Optional[datetime] = None
    lastSyncStatus: str = "pending"
    lastSyncError: Optional[str] = None


# ---------- Orders ----------
class OrderItem(BaseModel):
    productId: str
    sku: str
    name: str
    quantity: int
    price: float
    supplierId: Optional[str] = None
    supplierSku: Optional[str] = None
    supplierCost: float = 0


class Order(BaseDocument):
    orderNumber: str
    wpOrderId: Optional[int] = None
    customerName: str
    customerEmail: Optional[str] = None
    shippingAddress: Optional[dict] = None
    items: List[OrderItem] = []
    total: float = 0
    status: str = "pending"  # pending | processing | shipped | delivered | cancelled
    fulfillmentStatus: str = "unfulfilled"  # unfulfilled | in_progress | fulfilled
    trackingNumber: Optional[str] = None
    trackingCarrier: Optional[str] = None
    supplierOrderRef: Optional[str] = None
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=utc_now)
    updatedAt: datetime = Field(default_factory=utc_now)


# ---------- Notifications ----------
class Notification(BaseDocument):
    type: str  # low_stock, order_new, sync_error, price_change
    severity: str = "info"  # info, warning, critical
    title: str
    message: str
    link: Optional[str] = None
    read: bool = False
    createdAt: datetime = Field(default_factory=utc_now)


# ---------- Catalog Import ----------
class CatalogImportJob(BaseDocument):
    supplierId: str
    filename: str
    format: str  # csv, xlsx, json, xml
    mapping: dict = {}
    totalRows: int = 0
    imported: int = 0
    updated: int = 0
    errors: List[str] = []
    status: str = "pending"  # pending | processing | completed | failed
    createdAt: datetime = Field(default_factory=utc_now)
