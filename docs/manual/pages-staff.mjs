// Staff guide (Manager and Seller): English and Arabic, same pages and arrow numbers.
// Nothing here mentions the administrator, backups, files or the database.
export const cover = {
  en: { title: 'Anubis Pharmacy', sub: 'Staff guide · version', arrows: 'Each picture has <b style="color:#e11d48">red numbered arrows</b>.<br>The numbered steps under it say what each one does.<br><br>Sellers see only <b>POS</b> and <b>Inventory</b>; the other pages are for managers.', contents: 'Contents' },
  ar: { title: 'Anubis Pharmacy', sub: 'دليل الموظفين · الإصدار', arrows: 'في كل صورة <b style="color:#e11d48">أسهم حمراء مرقّمة</b>.<br>الخطوات المرقّمة تحت الصورة تشرح كل سهم.<br><br>البائع يرى <b>نقاط البيع</b> و<b>المخزون</b> فقط؛ باقي الصفحات للمشرف.', contents: 'المحتويات' }
}

export const pages = {
  en: [
    ['s01-signin', 'Sign in', 'Each person signs in with their own account. Forgot your password? Ask your manager to set a new one for you.', [
      'Your username.', 'Your password.', 'Press <b>Login</b>.']],
    ['s02-dashboard', 'The main menu', 'The menu on the left opens each page. You see only the pages your role allows.', [
      'Dashboard (today’s sales and each seller’s results) · POS (selling) · Inventory · Reports · Customers · Attendance · Users · Audit log · Settings.',
      'Press <b>AR</b> or <b>EN</b> to switch the language.',
      'Press <b>Logout</b> when you leave the counter.']],
    ['s03-settings', 'Settings (managers)', 'The pharmacy details printed on the invoice.', [
      'The pharmacy name. It is printed after the word “صيدلية”.',
      'The pharmacy phone number.',
      'Tick this only if you charge tax, then type the tax rate.',
      'The language the program opens in.',
      'Press <b>Save settings</b>.']],
    ['s04-users', 'Add a staff member (managers)', 'Open <b>Users</b> and press <b>Add user</b>. <b>Manager</b>: everything on these pages. <b>Seller</b>: only POS and Inventory. To change a password or stop an account, press <b>Edit</b> on the person’s card.', [
      'Username for the new person.',
      'Password (at least 3 characters).',
      'Role: Manager or Seller.',
      'User ID: leave it empty to get the next number, or type one. It must match the person’s number on the fingerprint machine.',
      'Press <b>Save</b>.']],
    ['s05-inventory-top', 'Inventory', 'Open <b>Inventory</b>.', [
      '<b>Add product</b>: add a product (next pages).',
      '<b>Receive carton</b>: scan the barcode, type the number of cartons, and the stock is added.']],
    ['s06-product-1', 'Add a product (1 of 2)', 'Press <b>Add product</b> and fill in:', [
      'The product name.',
      'Unit type: how you buy it — <b>Box</b>, <b>Strip</b> or <b>Pill</b>.',
      'How many strips are in one box.',
      'How many pills are in one strip (optional; fill it if you sell single pills).',
      'The price of one box. The strip and pill prices are worked out for you.']],
    ['s07-product-2', 'Add a product (2 of 2)', 'Then:', [
      'How many you have now.',
      'The minimum. At or below it the product turns <span class="red">red</span>.',
      'How early to warn. Within this many of the minimum it turns <span class="yellow">yellow</span>.',
      'If customers may return it: within how many days (leave empty if not).',
      'Press <b>Save product</b>.']],
    ['s08-inventory-list', 'The product list and stock colours', 'Every product shows its stock in boxes, strips and pills.', [
      '<span class="red">Red</span>: at or below the minimum — tell your manager to order now.',
      '<span class="yellow">Yellow</span>: near the minimum — order soon.',
      '<b>Adjust stock</b>: add or remove stock (next page).',
      '<b>Delete</b>: remove the product (managers). The program asks first.']],
    ['s09-adjust', 'Adjust stock', 'For new deliveries, damaged items or counting mistakes.', [
      'Counted in: boxes, strips or pills.',
      'How many: a plain number adds, a number with “-” removes (for example -1).',
      'Why (for example “Damaged box”).',
      'Press <b>Apply adjustment</b>.']],
    ['s10-customers', 'Customers (managers)', 'Open <b>Customers</b> and press <b>Add customer</b>. Fill at least one box.', [
      'Name.', 'ID number.', 'Phone number.',
      'Discount in % — applied by itself when you choose this customer at the POS.',
      'Press <b>Save customer</b>.']],
    ['s11-pos', 'Selling (POS)', 'Open <b>POS</b>.', [
      'Search by name, code or barcode — or just scan the barcode.',
      'Click the product to sell one box…',
      '…or click <b>Strip</b> or <b>Pill</b> under it to sell a strip or a single pill.',
      'Change the quantity here.',
      'Choose the customer (optional). Type the name or phone.',
      'Discount in % (filled from the customer; you can change it).',
      'How much the customer paid. The change is shown below it.',
      'Press <b>Complete sale</b>.']],
    ['s12-invoice', 'Print the invoice', 'The invoice shows the pharmacy name and phone, the customer, your name, the items, the total, the paid amount and the change (الباقي).', [
      'Press <b>Print</b>.', 'Press <b>New sale</b> for the next customer.']],
    ['s13-returns', 'Returns', 'Under the POS you see every item that can still be returned. Items drop off the list by themselves when their return days are over.', [
      'The returnable items list.',
      'Search by invoice number, product or customer.',
      'Press <b>Return</b> on the line the customer brings back.',
      'Or return a whole invoice from <b>Recent sales</b>.']],
    ['s14-return-confirm', 'Confirm a return', 'The money is refunded and the stock goes back.', [
      'Write a reason (optional).', 'Press <b>Confirm return</b>.']],
    ['s15-attendance', 'Attendance (managers)', 'Clock-in, clock-out, breaks and hours worked for each person, from the fingerprint machine.', [
      'From date…', '…to date.']],
    ['s16-reports', 'Reports (managers)', 'Sales totals, profit, best-selling products and stock value, and two Excel reports to download.', [
    'First day of the period…', '…last day (at most one year).',
    '<b>Sales report</b>: every invoice in the period with seller, customer, items, discount, tax and total, plus a totals row. Choose where to save the Excel file.',
    '<b>Purchasing report</b>: every purchase order in the period with supplier, products, quantities and costs, plus a totals row.']],
    ['s17-audit', 'Audit log (managers)', 'Every important action is recorded: who did it and when.', []]
  ],
  ar: [
    ['s01-signin', 'تسجيل الدخول', 'كل شخص يدخل بحسابه الخاص. نسيت كلمة المرور؟ اطلب من المشرف أن يعيّن لك كلمة جديدة.', [
      'اسم المستخدم.', 'كلمة المرور.', 'اضغط <b>تسجيل الدخول</b>.']],
    ['s02-dashboard', 'القائمة الرئيسية', 'القائمة الجانبية تفتح كل صفحة. ترى فقط الصفحات التي يسمح بها دورك.', [
      'لوحة التحكم (مبيعات اليوم ونتائج كل بائع) · نقاط البيع (البيع) · المخزون · التقارير · العملاء · الحضور · المستخدمون · سجل التدقيق · الإعدادات.',
      'اضغط <b>AR</b> أو <b>EN</b> لتغيير اللغة.',
      'اضغط <b>تسجيل الخروج</b> عندما تترك مكانك.']],
    ['s03-settings', 'الإعدادات (للمشرف)', 'بيانات الصيدلية التي تُطبع على الفاتورة.', [
      'اسم الصيدلية. يُطبع بعد كلمة «صيدلية».',
      'رقم هاتف الصيدلية.',
      'ضع علامة هنا فقط إذا كنت تحسب ضريبة، ثم اكتب نسبتها.',
      'اللغة التي يفتح بها البرنامج.',
      'اضغط <b>حفظ الإعدادات</b>.']],
    ['s04-users', 'إضافة موظف (للمشرف)', 'افتح <b>المستخدمون</b> واضغط <b>إضافة مستخدم</b>. <b>المشرف (Manager)</b>: كل هذه الصفحات. <b>البائع (Seller)</b>: نقاط البيع والمخزون فقط. لتغيير كلمة مرور أو إيقاف حساب اضغط <b>تعديل</b> على بطاقة الشخص.', [
      'اسم المستخدم للشخص الجديد.',
      'كلمة المرور (3 أحرف على الأقل).',
      'الدور: مشرف أو بائع.',
      'رقم المستخدم: اتركه فارغًا ليأخذ الرقم التالي، أو اكتبه. يجب أن يطابق رقم الشخص على جهاز البصمة.',
      'اضغط <b>حفظ</b>.']],
    ['s05-inventory-top', 'المخزون', 'افتح <b>المخزون</b>.', [
      '<b>إضافة منتج</b>: إضافة منتج (الصفحات التالية).',
      '<b>استلام كرتونة</b>: امسح الباركود واكتب عدد الكراتين، فيُضاف المخزون.']],
    ['s06-product-1', 'إضافة منتج (1 من 2)', 'اضغط <b>إضافة منتج</b> واملأ:', [
      'اسم المنتج.',
      'نوع الوحدة: كيف تشتريه — <b>علبة</b> أو <b>شريط</b> أو <b>قرص</b>.',
      'عدد الشرائط في العلبة.',
      'عدد الأقراص في الشريط (اختياري؛ املأه إذا كنت تبيع أقراصًا منفردة).',
      'سعر العلبة. سعر الشريط والقرص يُحسب تلقائيًا.']],
    ['s07-product-2', 'إضافة منتج (2 من 2)', 'ثم:', [
      'الكمية الموجودة الآن.',
      'الحد الأدنى. عند الوصول إليه أو أقل يصبح المنتج <span class="red">أحمر</span>.',
      'متى ننبّهك مبكرًا. إذا اقتربت من الحد الأدنى بهذا المقدار يصبح <span class="yellow">أصفر</span>.',
      'إذا كان يمكن للعميل إرجاعه: خلال كم يومًا (اتركه فارغًا إذا لا يُرجع).',
      'اضغط <b>حفظ المنتج</b>.']],
    ['s08-inventory-list', 'قائمة المنتجات وألوان المخزون', 'كل منتج يظهر رصيده بالعلب والشرائط والأقراص.', [
      '<span class="red">أحمر</span>: عند الحد الأدنى أو أقل — أبلغ المشرف ليطلب الآن.',
      '<span class="yellow">أصفر</span>: قريب من الحد الأدنى — اطلب قريبًا.',
      '<b>تعديل الرصيد</b>: إضافة أو خصم كمية (الصفحة التالية).',
      '<b>حذف</b>: حذف المنتج (للمشرف). البرنامج يسألك أولًا.']],
    ['s09-adjust', 'تعديل الرصيد', 'عند وصول بضاعة جديدة أو تلف أو خطأ في العدّ.', [
      'الوحدة: علب أو شرائط أو أقراص.',
      'الكمية: رقم عادي يضيف، ورقم بعلامة «-» يخصم (مثل ‎-1).',
      'السبب (مثل «علبة تالفة»).',
      'اضغط <b>تطبيق التعديل</b>.']],
    ['s10-customers', 'العملاء (للمشرف)', 'افتح <b>العملاء</b> واضغط <b>إضافة عميل</b>. املأ خانة واحدة على الأقل.', [
      'الاسم.', 'رقم الهوية.', 'رقم الهاتف.',
      'الخصم % — يُطبّق تلقائيًا عند اختيار هذا العميل في نقطة البيع.',
      'اضغط <b>حفظ العميل</b>.']],
    ['s11-pos', 'البيع (نقاط البيع)', 'افتح <b>نقاط البيع</b>.', [
      'ابحث بالاسم أو الكود أو الباركود — أو امسح الباركود مباشرة.',
      'اضغط على المنتج لبيع علبة…',
      '…أو اضغط <b>شريط</b> أو <b>قرص</b> تحته لبيع شريط أو قرص واحد.',
      'غيّر الكمية من هنا.',
      'اختر العميل (اختياري). اكتب الاسم أو الهاتف.',
      'الخصم % (يُملأ من بيانات العميل، ويمكنك تغييره).',
      'المبلغ الذي دفعه العميل. الباقي يظهر تحته.',
      'اضغط <b>إتمام البيع</b>.']],
    ['s12-invoice', 'طباعة الفاتورة', 'الفاتورة فيها اسم الصيدلية وهاتفها، العميل، اسمك، الأصناف، الإجمالي، المدفوع، والباقي.', [
      'اضغط <b>طباعة</b>.', 'اضغط <b>بيع جديد</b> للعميل التالي.']],
    ['s13-returns', 'المرتجعات', 'تحت نقطة البيع تجد كل الأصناف التي ما زال يمكن إرجاعها. الصنف يختفي من القائمة وحده عند انتهاء أيام الإرجاع.', [
      'قائمة المنتجات القابلة للإرجاع.',
      'ابحث برقم الفاتورة أو المنتج أو العميل.',
      'اضغط زر الإرجاع على السطر الذي أعاده العميل.',
      'أو أرجع فاتورة كاملة من <b>آخر المبيعات</b>.']],
    ['s14-return-confirm', 'تأكيد الإرجاع', 'يُرد المبلغ وترجع الكمية إلى المخزون.', [
      'اكتب السبب (اختياري).', 'اضغط <b>تأكيد الإرجاع</b>.']],
    ['s15-attendance', 'الحضور (للمشرف)', 'الحضور والانصراف والاستراحات وساعات العمل لكل شخص، من جهاز البصمة.', [
      'من تاريخ…', '…إلى تاريخ.']],
    ['s16-reports', 'التقارير (للمشرف)', 'إجمالي المبيعات، الربح، الأصناف الأكثر بيعًا، وقيمة المخزون، وتقريران إكسل للتنزيل.', [
    'أول يوم في الفترة…', '…آخر يوم (سنة على الأكثر).',
    '<b>تقرير المبيعات</b>: كل فاتورة في الفترة مع البائع والعميل والأصناف والخصم والضريبة والإجمالي، وسطر للإجماليات. اختر مكان حفظ ملف الإكسل.',
    '<b>تقرير المشتريات</b>: كل أمر شراء في الفترة مع المورد والمنتجات والكميات والتكلفة، وسطر للإجماليات.']],
    ['s17-audit', 'سجل التدقيق (للمشرف)', 'كل عملية مهمة تُسجَّل: من فعلها ومتى.', []]
  ]
}
