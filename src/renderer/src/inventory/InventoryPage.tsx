import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Category, Product, Unit } from '../../../shared/inventory'
import type { Language } from '../../../shared/settings'
import { centsToInput, formatMoney, parseMoney } from '../money'

interface Props {
  products: Product[]
  language: Language
  currency: string
  onChanged: () => void
}

const copy = {
  en: {
    title: 'Inventory',
    intro: 'Add products, keep prices correct, and record stock changes.',
    addProduct: 'Add product',
    editProduct: 'Edit product',
    search: 'Search name, SKU, or barcode',
    name: 'Product name',
    sku: 'SKU',
    barcode: 'Barcode (optional)',
    category: 'Category',
    unit: 'Unit',
    none: 'None',
    manageCatalog: 'Categories & units',
    categoryName: 'Category name',
    unitName: 'Unit name',
    unitAbbreviation: 'Abbreviation',
    addCategory: 'Add category',
    addUnit: 'Add unit',
    noCategories: 'No categories yet.',
    noUnits: 'No units yet.',
    purchaseCost: 'Purchase cost',
    sellingPrice: 'Selling price',
    unitsPerBox: 'Strips per box (1 = no box selling)',
    perBox: 'per box',
    boxPrice: 'Box selling price',
    cartonTitle: 'Receive carton',
    cartonHint: 'Scan the barcode, enter cartons and boxes per carton; stock is added automatically.',
    cartonBarcode: 'Barcode',
    cartonFind: 'Find',
    cartonProduct: 'Product',
    cartonSelect: 'Select a product',
    cartons: 'Cartons',
    boxesPerCarton: 'Boxes per carton',
    cartonSelling: 'Strip price (optional)',
    cartonBoxPrice: 'Box price (optional)',
    cartonReceive: 'Receive carton',
    cartonExpiry: 'Expiry date (optional)',
    cartonSummary: 'Will add',
    cartonUnits: 'units to stock',
    cartonNotFound: 'No product with this barcode.',
    unitsPerBoxInvalid: 'Strips per box must be 1 or more.',
    boxPriceRequired: 'Enter the box selling price when strips per box is more than 1.',
    stock: 'Opening stock',
    minStock: 'Minimum stock',
    active: 'Active (available for sale)',
    save: 'Save product',
    saving: 'Saving...',
    cancel: 'Cancel',
    adjust: 'Adjust stock',
    adjustTitle: 'Stock adjustment',
    adjustQuantity: 'Quantity (+ receive, - remove)',
    adjustReason: 'Reason',
    adjustSave: 'Apply adjustment',
    currentStock: 'Current stock',
    afterAdjust: 'Stock after adjustment',
    actions: 'Actions',
    noProducts: 'No products yet',
    noProductsHint: 'Add your first product to start selling.',
    noMatches: 'No products match your search.',
    lowStock: 'Low',
    outOfStock: 'Out',
    inactive: 'Inactive',
    expiryDate: 'Expiry date (optional)',
    expiry: 'Expiry',
    expired: 'Expired',
    expiresSoon: 'Expires soon',
    noExpiry: '-',
    criticalStock: 'Critical',
    saved: 'Saved successfully.',
    nameRequired: 'Product name is required.',
    skuRequired: 'SKU is required.',
    priceInvalid: 'Enter a valid price with up to 2 decimals.',
    stockInvalid: 'Stock must be a whole number of 0 or more.',
    minInvalid: 'Minimum stock must be a whole number of 0 or more.',
    adjustInvalid: 'Enter a non-zero whole quantity that does not make stock negative.',
    reasonRequired: 'Enter a reason for the adjustment.',
    error: 'Could not save',
    columns: ['Product', 'SKU', 'Price', 'Stock', 'Minimum', 'Expiry', 'Status']
  },
  ar: {
    title: 'المخزون',
    intro: 'أضف المنتجات، حافظ على صحة الأسعار، وسجّل حركات المخزون.',
    addProduct: 'إضافة منتج',
    editProduct: 'تعديل منتج',
    search: 'ابحث بالاسم أو الكود أو الباركود',
    name: 'اسم المنتج',
    sku: 'كود المنتج',
    barcode: 'الباركود (اختياري)',
    category: 'الفئة',
    unit: 'الوحدة',
    none: 'بدون',
    manageCatalog: 'الفئات والوحدات',
    categoryName: 'اسم الفئة',
    unitName: 'اسم الوحدة',
    unitAbbreviation: 'الاختصار',
    addCategory: 'إضافة فئة',
    addUnit: 'إضافة وحدة',
    noCategories: 'لا توجد فئات بعد.',
    noUnits: 'لا توجد وحدات بعد.',
    purchaseCost: 'سعر الشراء',
    sellingPrice: 'سعر البيع',
    unitsPerBox: 'عدد الشرائط في العلبة (1 = بدون بيع بالعلبة)',
    perBox: 'لكل علبة',
    boxPrice: 'سعر بيع العلبة',
    cartonTitle: 'استلام كرتونة',
    cartonHint: 'امسح الباركود، أدخل عدد الكراتين والعلب في الكرتونة، ويُضاف المخزون تلقائيًا.',
    cartonBarcode: 'الباركود',
    cartonFind: 'بحث',
    cartonProduct: 'المنتج',
    cartonSelect: 'اختر منتجًا',
    cartons: 'عدد الكراتين',
    boxesPerCarton: 'علب في الكرتونة',
    cartonSelling: 'سعر الشريط (اختياري)',
    cartonBoxPrice: 'سعر العلبة (اختياري)',
    cartonReceive: 'استلام الكرتونة',
    cartonExpiry: 'تاريخ الانتهاء (اختياري)',
    cartonSummary: 'سيُضاف',
    cartonUnits: 'وحدة للمخزون',
    cartonNotFound: 'لا يوجد منتج بهذا الباركود.',
    unitsPerBoxInvalid: 'عدد الشرائط في العلبة يجب أن يكون 1 أو أكثر.',
    boxPriceRequired: 'أدخل سعر بيع العلبة عندما يكون عدد الشرائط أكبر من 1.',
    stock: 'الرصيد الافتتاحي',
    minStock: 'الحد الأدنى',
    active: 'نشط (متاح للبيع)',
    save: 'حفظ المنتج',
    saving: 'جارٍ الحفظ...',
    cancel: 'إلغاء',
    adjust: 'تعديل الرصيد',
    adjustTitle: 'تعديل رصيد المخزون',
    adjustQuantity: 'الكمية (+ إضافة، - خصم)',
    adjustReason: 'السبب',
    adjustSave: 'تطبيق التعديل',
    currentStock: 'الرصيد الحالي',
    afterAdjust: 'الرصيد بعد التعديل',
    actions: 'الإجراءات',
    noProducts: 'لا توجد منتجات بعد',
    noProductsHint: 'أضف أول منتج لبدء البيع.',
    noMatches: 'لا توجد منتجات مطابقة للبحث.',
    lowStock: 'منخفض',
    outOfStock: 'نفد',
    inactive: 'غير نشط',
    expiryDate: 'تاريخ الانتهاء (اختياري)',
    expiry: 'الانتهاء',
    expired: 'منتهي الصلاحية',
    expiresSoon: 'قارب على الانتهاء',
    noExpiry: '-',
    criticalStock: 'حرج',
    saved: 'تم الحفظ بنجاح.',
    nameRequired: 'اسم المنتج مطلوب.',
    skuRequired: 'كود المنتج مطلوب.',
    priceInvalid: 'أدخل سعرًا صحيحًا بحد أقصى منزلتين عشريتين.',
    stockInvalid: 'الرصيد يجب أن يكون عددًا صحيحًا يساوي صفرًا أو أكثر.',
    minInvalid: 'الحد الأدنى يجب أن يكون عددًا صحيحًا يساوي صفرًا أو أكثر.',
    adjustInvalid: 'أدخل كمية صحيحة غير صفرية لا تجعل الرصيد سالبًا.',
    reasonRequired: 'أدخل سبب تعديل الرصيد.',
    error: 'تعذّر الحفظ',
    columns: ['المنتج', 'الكود', 'السعر', 'الرصيد', 'الحد الأدنى', 'الانتهاء', 'الحالة']
  }
} as const

const STOCK_CRITICAL = 3
const STOCK_LOW = 6
const EXPIRY_SOON_DAYS = 30

function daysUntil(date: string | undefined): number | null {
  if (!date) return null
  const target = new Date(`${date.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

interface FormState {
  name: string
  sku: string
  barcode: string
  categoryId: string
  unitId: string
  expiryDate: string
  purchase: string
  selling: string
  unitsPerBox: string
  boxPrice: string
  stock: string
  minStock: string
  active: boolean
}

function emptyForm(): FormState {
  return {
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unitId: '',
    expiryDate: '',
    purchase: '0.00',
    selling: '0.00',
    unitsPerBox: '1',
    boxPrice: '',
    stock: '0',
    minStock: '0',
    active: true
  }
}

function formFrom(product: Product): FormState {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    unitId: product.unitId ?? '',
    expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : '',
    purchase: centsToInput(product.purchaseCostCents),
    selling: centsToInput(product.sellingPriceCents),
    unitsPerBox: String(product.unitsPerBox ?? 1),
    boxPrice: product.boxPriceCents ? centsToInput(product.boxPriceCents) : '',
    stock: String(product.stockQuantity),
    minStock: String(product.minStock),
    active: product.active !== false
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function wholeNumber(value: string, min: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min ? parsed : null
}

export default function InventoryPage({ products, language, currency, onChanged }: Props) {
  const text = copy[language]
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [unitName, setUnitName] = useState('')
  const [unitAbbreviation, setUnitAbbreviation] = useState('')
  const [cartonBarcode, setCartonBarcode] = useState('')
  const [cartonProductId, setCartonProductId] = useState('')
  const [cartons, setCartons] = useState('1')
  const [boxesPerCarton, setBoxesPerCarton] = useState('1')
  const [cartonSelling, setCartonSelling] = useState('')
  const [cartonBoxPrice, setCartonBoxPrice] = useState('')
  const [cartonExpiry, setCartonExpiry] = useState('')

  async function loadCatalog(): Promise<void> {
    if (!window.api) return
    try {
      const [categoryList, unitList] = await Promise.all([
        window.api.invCategoriesList(),
        window.api.invUnitsList()
      ])
      setCategories(categoryList)
      setUnits(unitList)
    } catch {}
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = [...products].sort((a, b) => a.name.localeCompare(b.name))
    if (!needle) return list
    return list.filter((product) =>
      [product.name, product.sku, product.barcode ?? ''].some((value) =>
        value.toLowerCase().includes(needle)
      )
    )
  }, [products, query])

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openCreate(): void {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
    setAdjusting(null)
    setError('')
    setSuccess('')
  }

  function openEdit(product: Product): void {
    setEditing(product)
    setForm(formFrom(product))
    setFormOpen(true)
    setAdjusting(null)
    setError('')
    setSuccess('')
  }

  function openAdjust(product: Product): void {
    setAdjusting(product)
    setAdjustQuantity('')
    setAdjustReason('')
    setFormOpen(false)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')

    const name = form.name.trim()
    if (!name) return setError(text.nameRequired)
    const sku = form.sku.trim()
    if (!sku) return setError(text.skuRequired)

    const purchase = parseMoney(form.purchase)
    const selling = parseMoney(form.selling)
    if (purchase === null || selling === null) return setError(text.priceInvalid)
    const minStock = wholeNumber(form.minStock, 0)
    if (minStock === null) return setError(text.minInvalid)
    const openingStock = wholeNumber(form.stock, 0)
    if (openingStock === null) return setError(text.stockInvalid)
    const unitsPerBox = wholeNumber(form.unitsPerBox, 1)
    if (unitsPerBox === null) return setError(text.unitsPerBoxInvalid)
    let boxPriceCents: number | undefined
    if (unitsPerBox > 1) {
      const boxPrice = parseMoney(form.boxPrice)
      if (boxPrice === null || boxPrice <= 0) return setError(text.boxPriceRequired)
      boxPriceCents = boxPrice
    }

    const payload: Partial<Product> = {
      name,
      sku,
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId || undefined,
      unitId: form.unitId || undefined,
      expiryDate: form.expiryDate || undefined,
      purchaseCostCents: purchase,
      sellingPriceCents: selling,
      unitsPerBox,
      minStock,
      active: form.active
    }
    if (boxPriceCents !== undefined) payload.boxPriceCents = boxPriceCents
    if (!editing) payload.stockQuantity = openingStock

    setBusy(true)
    try {
      if (editing?._id) {
        await window.api.invProductsUpdate(editing._id, payload)
      } else {
        await window.api.invProductsCreate(payload)
      }
      setFormOpen(false)
      setEditing(null)
      setSuccess(text.saved)
      onChanged()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdjust(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!adjusting?._id) return
    setError('')
    setSuccess('')

    if (!/^-?\d+$/.test(adjustQuantity.trim())) return setError(text.adjustInvalid)
    const quantity = Number(adjustQuantity)
    if (!Number.isSafeInteger(quantity) || quantity === 0) return setError(text.adjustInvalid)
    if (adjusting.stockQuantity + quantity < 0) return setError(text.adjustInvalid)
    const reason = adjustReason.trim()
    if (!reason) return setError(text.reasonRequired)

    setBusy(true)
    try {
      await window.api.invStockAdjust({ productId: adjusting._id, quantity, reason })
      setAdjusting(null)
      setSuccess(text.saved)
      onChanged()
    } catch (adjustError) {
      setError(`${text.error}: ${message(adjustError)}`)
    } finally {
      setBusy(false)
    }
  }

  const cartonProduct = products.find((product) => product._id === cartonProductId) ?? null
  const cartonUnits =
    (wholeNumber(cartons, 1) ?? 0) *
    (wholeNumber(boxesPerCarton, 1) ?? 0) *
    Math.max(1, cartonProduct?.unitsPerBox ?? 1)

  function selectCartonProduct(product: Product): void {
    setCartonProductId(product._id ?? '')
    setCartonSelling(centsToInput(product.sellingPriceCents))
    setCartonBoxPrice(product.boxPriceCents ? centsToInput(product.boxPriceCents) : '')
    setCartonExpiry(product.expiryDate ? product.expiryDate.slice(0, 10) : '')
  }

  function findCartonProduct(): void {
    const code = cartonBarcode.trim()
    const product = products.find(
      (item) => item.barcode === code || item.sku.toLowerCase() === code.toLowerCase()
    )
    if (!product) return setError(text.cartonNotFound)
    setError('')
    selectCartonProduct(product)
  }

  async function handleReceiveCarton(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!cartonProduct?._id) return setError(text.cartonNotFound)
    const cartonCount = wholeNumber(cartons, 1)
    const boxCount = wholeNumber(boxesPerCarton, 1)
    if (cartonCount === null || boxCount === null) return setError(text.adjustInvalid)
    const selling = cartonSelling.trim() ? parseMoney(cartonSelling) ?? undefined : undefined
    const boxPrice = cartonBoxPrice.trim() ? parseMoney(cartonBoxPrice) ?? undefined : undefined
    if (cartonSelling.trim() && selling === undefined) return setError(text.priceInvalid)
    if (cartonBoxPrice.trim() && boxPrice === undefined) return setError(text.priceInvalid)

    setBusy(true)
    try {
      await window.api.invReceiveCarton({
        productId: cartonProduct._id,
        cartons: cartonCount,
        boxesPerCarton: boxCount,
        ...(selling !== undefined ? { sellingPriceCents: selling } : {}),
        ...(boxPrice !== undefined ? { boxPriceCents: boxPrice } : {}),
        ...(cartonExpiry ? { expiryDate: cartonExpiry } : {})
      })
      setSuccess(
        `${text.saved} ${text.cartonSummary} ${cartonCount * boxCount * Math.max(1, cartonProduct.unitsPerBox ?? 1)} ${text.cartonUnits}.`
      )
      setCartonBarcode('')
      setCartonProductId('')
      setCartons('1')
      setBoxesPerCarton('1')
      setCartonSelling('')
      setCartonBoxPrice('')
      setCartonExpiry('')
      onChanged()
    } catch (cartonError) {
      setError(`${text.error}: ${message(cartonError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) return setError(text.nameRequired)
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await window.api.invCategoriesCreate({ name })
      setCategoryName('')
      await loadCatalog()
      setSuccess(text.saved)
    } catch (createError) {
      setError(`${text.error}: ${message(createError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function addUnit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const name = unitName.trim()
    const abbreviation = unitAbbreviation.trim()
    if (!name || !abbreviation) return setError(text.nameRequired)
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await window.api.invUnitsCreate({ name, abbreviation })
      setUnitName('')
      setUnitAbbreviation('')
      await loadCatalog()
      setSuccess(text.saved)
    } catch (createError) {
      setError(`${text.error}: ${message(createError)}`)
    } finally {
      setBusy(false)
    }
  }

  const previewStock = adjusting
    ? adjusting.stockQuantity + (Number.isSafeInteger(Number(adjustQuantity)) ? Number(adjustQuantity) : 0)
    : 0

  return (
    <section className="panel inventory-page" aria-labelledby="inventory-title">
      <div className="section-header">
        <div>
          <h2 id="inventory-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          {text.addProduct}
        </button>
      </div>

      {formOpen ? (
        <form className="crud-form" onSubmit={handleSubmit}>
          <div className="crud-form-header">
            <h3>{editing ? text.editProduct : text.addProduct}</h3>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setFormOpen(false)
                setEditing(null)
              }}
            >
              {text.cancel}
            </button>
          </div>
          <div className="crud-grid">
            <label className="wide">
              <span>{text.name}</span>
              <input
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label>
              <span>{text.sku}</span>
              <input
                value={form.sku}
                onChange={(event) => update('sku', event.target.value)}
                maxLength={60}
                required
              />
            </label>
            <label>
              <span>{text.barcode}</span>
              <input
                value={form.barcode}
                onChange={(event) => update('barcode', event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span>{text.expiryDate}</span>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(event) => update('expiryDate', event.target.value)}
              />
            </label>
            <label>
              <span>{text.category}</span>
              <select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>
                <option value="">{text.none}</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{text.unit}</span>
              <select value={form.unitId} onChange={(event) => update('unitId', event.target.value)}>
                <option value="">{text.none}</option>
                {units.map((unit) => (
                  <option key={unit._id} value={unit._id}>{unit.name} ({unit.abbreviation})</option>
                ))}
              </select>
            </label>
            <label>
              <span>{text.purchaseCost}</span>
              <input
                inputMode="decimal"
                value={form.purchase}
                onChange={(event) => update('purchase', event.target.value)}
                required
              />
            </label>
            <label>
              <span>{text.sellingPrice}</span>
              <input
                inputMode="decimal"
                value={form.selling}
                onChange={(event) => update('selling', event.target.value)}
                required
              />
            </label>
            <label>
              <span>{text.unitsPerBox}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={form.unitsPerBox}
                onChange={(event) => update('unitsPerBox', event.target.value)}
                required
              />
            </label>
            {Number(form.unitsPerBox) > 1 ? (
              <label>
                <span>{text.boxPrice}</span>
                <input
                  inputMode="decimal"
                  value={form.boxPrice}
                  onChange={(event) => update('boxPrice', event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label>
              <span>{text.stock}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={(event) => update('stock', event.target.value)}
                disabled={Boolean(editing)}
                required
              />
            </label>
            <label>
              <span>{text.minStock}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.minStock}
                onChange={(event) => update('minStock', event.target.value)}
                required
              />
            </label>
            <label className="checkbox wide">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => update('active', event.target.checked)}
              />
              <span>{text.active}</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? text.saving : text.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setEditing(null)
              }}
            >
              {text.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <form className="crud-form carton-form" onSubmit={handleReceiveCarton}>
        <div className="crud-form-header">
          <div>
            <h3>{text.cartonTitle}</h3>
            <p className="muted">{text.cartonHint}</p>
          </div>
        </div>
        <div className="crud-grid">
          <label>
            <span>{text.cartonBarcode}</span>
            <input
              value={cartonBarcode}
              onChange={(event) => setCartonBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  findCartonProduct()
                }
              }}
              maxLength={80}
            />
          </label>
          <label>
            <span>{text.cartonProduct}</span>
            <select
              value={cartonProductId}
              onChange={(event) => {
                const product = products.find((item) => item._id === event.target.value)
                if (product) selectCartonProduct(product)
                else setCartonProductId('')
              }}
            >
              <option value="">{text.cartonSelect}</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{text.cartons}</span>
            <input type="number" min={1} step={1} value={cartons} onChange={(event) => setCartons(event.target.value)} required />
          </label>
          <label>
            <span>{text.boxesPerCarton}</span>
            <input type="number" min={1} step={1} value={boxesPerCarton} onChange={(event) => setBoxesPerCarton(event.target.value)} required />
          </label>
          <label>
            <span>{text.cartonSelling}</span>
            <input inputMode="decimal" value={cartonSelling} onChange={(event) => setCartonSelling(event.target.value)} />
          </label>
          {(cartonProduct?.unitsPerBox ?? 1) > 1 ? (
            <label>
              <span>{text.cartonBoxPrice}</span>
              <input inputMode="decimal" value={cartonBoxPrice} onChange={(event) => setCartonBoxPrice(event.target.value)} />
            </label>
          ) : null}
          <label>
            <span>{text.cartonExpiry}</span>
            <input type="date" value={cartonExpiry} onChange={(event) => setCartonExpiry(event.target.value)} />
          </label>
          <div className="readout">
            <span>{text.cartonSummary}</span>
            <strong>{cartonUnits} {text.cartonUnits}</strong>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy || !cartonProduct}>
            {busy ? text.saving : text.cartonReceive}
          </button>
          <button type="button" onClick={findCartonProduct}>{text.cartonFind}</button>
        </div>
      </form>

      <section className="panel inline-panel">
        <h3>{text.manageCatalog}</h3>
        <div className="crud-grid">
          <div>
            <form className="crud-form compact-form" onSubmit={addCategory}>
              <div className="crud-grid">
                <label>
                  <span>{text.categoryName}</span>
                  <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={80} required />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={busy}>{text.addCategory}</button>
              </div>
            </form>
            {categories.length === 0 ? <p className="muted">{text.noCategories}</p> : (
              <ul className="movement-list">
                {categories.map((category) => <li key={category._id}><span>{category.name}</span></li>)}
              </ul>
            )}
          </div>
          <div>
            <form className="crud-form compact-form" onSubmit={addUnit}>
              <div className="crud-grid">
                <label>
                  <span>{text.unitName}</span>
                  <input value={unitName} onChange={(event) => setUnitName(event.target.value)} maxLength={80} required />
                </label>
                <label>
                  <span>{text.unitAbbreviation}</span>
                  <input value={unitAbbreviation} onChange={(event) => setUnitAbbreviation(event.target.value)} maxLength={20} required />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={busy}>{text.addUnit}</button>
              </div>
            </form>
            {units.length === 0 ? <p className="muted">{text.noUnits}</p> : (
              <ul className="movement-list">
                {units.map((unit) => <li key={unit._id}><span>{unit.name} ({unit.abbreviation})</span></li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      {adjusting ? (
        <form className="crud-form" onSubmit={handleAdjust}>
          <div className="crud-form-header">
            <h3>
              {text.adjustTitle}: {adjusting.name}
            </h3>
            <button type="button" className="link-button" onClick={() => setAdjusting(null)}>
              {text.cancel}
            </button>
          </div>
          <div className="crud-grid">
            <div className="readout">
              <span>{text.currentStock}</span>
              <strong>{adjusting.stockQuantity}</strong>
            </div>
            <div className="readout">
              <span>{text.afterAdjust}</span>
              <strong className={previewStock < 0 ? 'danger-text' : ''}>{previewStock}</strong>
            </div>
            <label>
              <span>{text.adjustQuantity}</span>
              <input
                inputMode="numeric"
                value={adjustQuantity}
                onChange={(event) => setAdjustQuantity(event.target.value)}
                placeholder="0"
                required
              />
            </label>
            <label>
              <span>{text.adjustReason}</span>
              <input
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                maxLength={120}
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {text.adjustSave}
            </button>
            <button type="button" onClick={() => setAdjusting(null)}>
              {text.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      <div className="toolbar">
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
          aria-label={text.search}
        />
        <span className="muted">
          {filtered.length} / {products.length}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <strong>{text.noProducts}</strong>
          <p>{text.noProductsHint}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{text.noMatches}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {text.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
                <th>{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const remaining = daysUntil(product.expiryDate)
                const expired = remaining !== null && remaining < 0
                const expiresSoon = remaining !== null && remaining >= 0 && remaining <= EXPIRY_SOON_DAYS
                const critical = !expired && product.stockQuantity <= STOCK_CRITICAL
                const low = !expired && !critical && product.stockQuantity <= STOCK_LOW
                const out = product.stockQuantity <= 0
                return (
                  <tr key={product._id ?? product.sku} className={product.active ? '' : 'row-muted'}>
                    <td>
                      <strong>{product.name}</strong>
                      {product.barcode ? <small className="block-muted">{product.barcode}</small> : null}
                      {(product.unitsPerBox ?? 1) > 1 ? (
                        <small className="block-muted">
                          {text.boxPrice}: {formatMoney(product.boxPriceCents ?? 0, currency)} ({product.unitsPerBox} {text.perBox})
                        </small>
                      ) : null}
                    </td>
                    <td>{product.sku}</td>
                    <td>{formatMoney(product.sellingPriceCents, currency)}</td>
                    <td className={critical || expired ? 'danger-text' : low ? 'warning-text' : ''}>{product.stockQuantity}</td>
                    <td>{product.minStock}</td>
                    <td>
                      {product.expiryDate ? (
                        <span className={`tag ${expired ? 'danger-tag' : expiresSoon ? 'warning-tag' : 'ok-tag'}`}>
                          {product.expiryDate.slice(0, 10)}
                        </span>
                      ) : (
                        <span className="muted">{text.noExpiry}</span>
                      )}
                    </td>
                    <td>
                      {!product.active ? (
                        <span className="tag">{text.inactive}</span>
                      ) : expired ? (
                        <span className="tag danger-tag">{text.expired}</span>
                      ) : out ? (
                        <span className="tag danger-tag">{text.outOfStock}</span>
                      ) : critical ? (
                        <span className="tag danger-tag">{text.criticalStock}</span>
                      ) : low ? (
                        <span className="tag warning-tag">{text.lowStock}</span>
                      ) : expiresSoon ? (
                        <span className="tag warning-tag">{text.expiresSoon}</span>
                      ) : (
                        <span className="tag ok-tag">OK</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => openEdit(product)}>
                          {text.editProduct}
                        </button>
                        <button type="button" onClick={() => openAdjust(product)}>
                          {text.adjust}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
