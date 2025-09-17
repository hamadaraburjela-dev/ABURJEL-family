/**
 * @file Code.gs
 * @description Backend logic for the Family Aid System.
 * @version 4.3.1 - Fix switch issues, input/file validation, safe dates.
 */

/* ================================
   --- GLOBAL CONFIGURATION ---
================================== */
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '1XTa4VoZ1XEavhi8Zb-bibsgNFNRo3wy3SSqlnjGF4iI';
const APP_VERSION = '4.3.1';

const INDIVIDUALS_SHEET = 'الأفراد';
const AID_RECORDS_SHEET = 'المساعدات';
const ADMINS_SHEET = 'المدراء';
const INDIVIDUALS_LOGIN_LOG_SHEET = 'سجل دخول الأفراد';
const ADMINS_LOGIN_LOG_SHEET = 'سجل دخول المدراء';
const ADMIN_ACTIONS_LOG_SHEET = 'سجل عمليات المدراء';
const PASSWORD_RESET_REQUESTS_SHEET = 'طلبات إعادة تعيين';
const EVENTS_LOG_SHEET = 'سجل الأحداث';

const WOUNDED_LOG_SHEET = 'سجل الجرحى';
const DRIVE_FOLDER_ID = 'ضع-معرف-المجلد-هنا';

/* ================================
   --- UTIL HELPERS ---
================================== */
function assertRequired(obj, fields, msgPrefix) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '') {
      throw new Error((msgPrefix || 'بيانات ناقصة') + `: الحقل "${f}" مطلوب.`);
    }
  }
}

function parseDateSafe(input, fieldName) {
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error(`تنسيق التاريخ غير صالح للحقل "${fieldName}".`);
  return d;
}

function formatDateISO(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validateUpload(fileObj, { allowMime = ['application/pdf', 'image/jpeg', 'image/png'], maxBytes = 15 * 1024 * 1024 } = {}) {
  if (!fileObj || !fileObj.data) throw new Error('ملف مفقود أو غير صالح.');
  if (!allowMime.includes(fileObj.mimeType)) {
    throw new Error(`نوع الملف غير مسموح. الأنواع المسموحة: ${allowMime.join(', ')}`);
  }
  const sizeBytes = Math.ceil((fileObj.data.length * 3) / 4);
  if (sizeBytes > maxBytes) {
    throw new Error(`حجم الملف أكبر من الحد المسموح (${Math.round(maxBytes / (1024 * 1024))}MB).`);
  }
}

function sheetToJSON(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift().map(h => String(h).trim());
  return values.map(row =>
    headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {})
  );
}

function authenticateToken(token, requiredRole = null) {
  if (!token) throw new Error('رمز الجلسة مفقود. الرجاء تسجيل الدخول.');
  const cache = CacheService.getScriptCache();
  const storedData = cache.get(token);
  if (!storedData) throw new Error('انتهت صلاحية الجلسة أو غير صالحة. الرجاء تسجيل الدخول مرة أخرى.');
  const admin = JSON.parse(storedData);
  // تحقق من انتهاء صلاحية التوكن (مثال: 30 دقيقة)
  if (admin.expiry && new Date(admin.expiry) < new Date()) {
    throw new Error('انتهت صلاحية الجلسة. الرجاء تسجيل الدخول من جديد.');
  }
  if (requiredRole && admin.role !== 'superadmin' && admin.role !== requiredRole) {
    throw new Error('ليس لديك الصلاحية الكافية لهذا الإجراء.');
  }
  return admin;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function generateToken() {
  return Utilities.getUuid();
}

function logAdminAction(username, actionType, details) {
  const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ADMIN_ACTIONS_LOG_SHEET);
  if (logSheet) logSheet.appendRow([new Date(), username, actionType, details]);
}

/* ================================
   --- MAIN ENTRY POINTS ---
================================== */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', version: APP_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    let response;

    switch (payload.action) {
      case 'checkPasswordStatus': response = handleCheckPasswordStatus(payload.id, payload.spouse_id); break;
      case 'userLoginWithPassword': response = handleUserLoginWithPassword(payload.id, payload.spouse_id, payload.password); break;
      case 'setMemberPassword': response = handleSetMemberPassword(payload.userId, payload.password); break;
      case 'adminLogin': response = handleAdminLogin(payload.username, payload.password); break;
      case 'getUserData': response = handleGetUserData(payload.userId); break;
      case 'getUserAidHistory': response = handleGetUserAidHistory(payload.userId); break;
      case 'getUserFutureAid': response = handleGetUserFutureAid(payload.userId); break;
      case 'getAdminStats': response = handleGetStats(payload.token); break;
      case 'getAllMembers': response = handleGetAllMembers(payload.token, payload.searchTerm, payload.page, payload.pageSize); break;
      case 'getAdmins': response = handleGetAdmins(payload.token); break;
      case 'getAllAidRecords': response = handleGetAllAidRecords(payload.token); break;
      case 'addAid': response = handleAddAid(payload); break;
      case 'bulkAddAidFromXLSX': response = handleBulkAddAidFromXLSX(payload); break;
      case 'createAdmin': response = handleCreateAdmin(payload); break;
      case 'updateAdminStatus': response = handleUpdateAdminStatus(payload); break;
      case 'updateMember': response = handleUpdateMember(payload); break;
      case 'generateReport': response = handleGenerateReport(payload); break;
      case 'requestPasswordReset': response = handlePasswordResetRequest(payload.userId); break;
      case 'getResetRequests': response = handleGetResetRequests(payload.token); break;
      case 'clearMemberPassword': response = handleClearMemberPassword(payload); break;
      case 'updateAidStatus': response = handleUpdateAidStatus(payload); break;
      case 'bulkProcessAid': response = handleBulkProcessAid(payload); break;
      case 'addEvent': response = handleAddEvent(payload); break;
      case 'getEvents': response = handleGetEvents(payload); break;
      case 'addWoundedCase': response = handleAddWoundedCase(e.postData.contents); break;
      default: response = { success: false, message: 'Action غير معروف.' };
    }

    return createJsonResponse(response);
  } catch (error) {
    Logger.log(error);
    return createJsonResponse({ success: false, message: error.message });
  }
}

/* ================================
   --- FEATURE HANDLERS ---
================================== */
function handleAddEvent(payload) {
  const { eventType, personName, personId, eventDate, eventNotes } = payload;
  assertRequired({ eventType, personName, eventDate }, ['eventType', 'personName', 'eventDate'], 'الرجاء تعبئة الحقول المطلوبة');

  const eventSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_LOG_SHEET);
  const eventId = `EVT${Date.now()}`;
  const registrationDate = new Date();
  const registrar = 'تم التسجيل بواسطة فرد';

  const eventDateObj = parseDateSafe(eventDate, 'eventDate');
  eventSheet.appendRow([eventId, eventType, personName, personId || '', eventDateObj, eventNotes || '', registrationDate, registrar]);
  return { success: true, message: 'تم تسجيل الحدث بنجاح!' };
}

function handleAdminLogin(username, password) {
  const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ADMINS_LOGIN_LOG_SHEET);
  let logStatus = 'فاشل';
  let logReason = '';
  try {
    if (!username || !password) {
      logReason = 'بيانات غير مكتملة';
      throw new Error('يجب إدخال اسم المستخدم وكلمة المرور.');
    }
    const admins = sheetToJSON(ADMINS_SHEET);
    const adminUser = admins.find(u => u['اسم المستخدم'] == username && u['كلمة المرور (SHA-256)'] == password);
    if (!adminUser) {
      logReason = 'بيانات الدخول غير صحيحة';
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
    if (adminUser['الحالة'] !== 'Active') {
      logReason = 'الحساب غير نشط';
      throw new Error('هذا الحساب غير نشط.');
    }
    const token = generateToken();
    const tokenData = { username: adminUser['اسم المستخدم'], role: adminUser['الصلاحية'] };
    CacheService.getScriptCache().put(token, JSON.stringify(tokenData), 1800);
    logStatus = 'ناجح';
    return { success: true, token: token, role: adminUser['الصلاحية'] };
  } catch (error) {
    throw error;
  } finally {
    logSheet.appendRow([new Date(), username, logStatus, logReason]);
  }
}

function handleGetEvents(payload = {}) {
  const { page = 1, pageSize = 200 } = payload || {};
  const events = sheetToJSON(EVENTS_LOG_SHEET)
    .map(e => ({ ...e, 'تاريخ الحدث': formatDateISO(e['تاريخ الحدث']), 'تاريخ التسجيل': formatDateISO(e['تاريخ التسجيل']) }))
    .sort((a, b) => new Date(b['تاريخ التسجيل']) - new Date(a['تاريخ التسجيل']));
  const start = Math.max(0, (page - 1) * pageSize);
  const slice = events.slice(start, start + pageSize);
  return { success: true, data: slice, total: events.length, page, pageSize };
}

function handleGetStats(token) {
  authenticateToken(token);
  const individuals = sheetToJSON(INDIVIDUALS_SHEET);
  const aidRecords = sheetToJSON(AID_RECORDS_SHEET);

  const childrenCountCol = 'عدد الأولاد';
  let totalIndividuals = 0;
  individuals.forEach(p => totalIndividuals += (Number(p[childrenCountCol]) || 0));

  const totalFamilies = individuals.length;
  const totalAid = aidRecords.length;

  const divorcedCount = individuals.filter(p => p['الحالة الاجتماعية'] === 'مطلقة').length;
  const martyrsCount = individuals.filter(p => p['الحالة الخاصة'] === 'شهيد').length;
  const woundedCount = individuals.filter(p => p['الحالة الخاصة'] === 'جريح').length;

  return { success: true, stats: {
    totalIndividuals, totalAid, totalFamilies,
    divorced: divorcedCount,
    martyrs: martyrsCount,
    wounded: woundedCount,
    branchAhmad: individuals.filter(p => p['الفرع'] === 'ال احمد').length,
    branchHamed: individuals.filter(p => p['الفرع'] === 'ال حامد').length,
    branchHamdan: individuals.filter(p => p['الفرع'] === 'ال حمدان').length,
    branchHammad: individuals.filter(p => p['الفرع'] === 'ال حماد').length
  }};
}

function handleAddAid(payload) {
  const admin = authenticateToken(payload.token);
  assertRequired(payload, ['aidMemberId', 'aidType', 'aidDate', 'aidSource'], 'الرجاء تعبئة جميع الحقول المطلوبة');
  const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
  const newRecordId = 'AID' + Date.now();
  const aidDateObj = parseDateSafe(payload.aidDate, 'aidDate');
  aidSheet.appendRow([newRecordId, payload.aidMemberId, payload.aidType, aidDateObj, payload.aidSource, payload.aidNotes || '', new Date(), admin.username, payload.aidStatus || 'Completed']);
  logAdminAction(admin.username, 'إضافة مساعدة فردية', `تمت إضافة مساعدة من نوع ${payload.aidType} للمستفيد ${payload.aidMemberId}.`);
  return { success: true, message: 'تمت إضافة المساعدة بنجاح!' };
}

function handleBulkAddAidFromXLSX(payload) {
  const admin = authenticateToken(payload.token);
  if (!payload.fileContent) throw new Error('محتوى الملف مفقود.');
  let tempFileId = null;
  try {
    const bytes = Utilities.base64Decode(payload.fileContent);
    const blob = Utilities.newBlob(bytes, MimeType.MICROSOFT_EXCEL, 'temp_file.xlsx');
    const tempFile = DriveApp.createFile(blob);
    tempFileId = tempFile.getId();
    const spreadsheet = SpreadsheetApp.openById(tempFileId);
    const sheet = spreadsheet.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const headers = data.shift().map(h => String(h).trim());
    const expectedHeaders = ['معرف المستفيد', 'نوع المساعدة', 'تاريخ الاستلام', 'مصدر المساعدة', 'ملاحظات', 'حالة المساعدة'];
    const headerMapping = {};
    expectedHeaders.forEach(expectedHeader => {
      const index = headers.indexOf(expectedHeader);
      if (index === -1) throw new Error(`عمود "${expectedHeader}" مفقود.`);
      headerMapping[expectedHeader] = index;
    });

    const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
    const registrationDate = new Date();
    const rowsToAppend = [];
    data.forEach((row, i) => {
      const aidMemberId = row[headerMapping['معرف المستفيد']];
      const aidType = row[headerMapping['نوع المساعدة']];
      const aidDate = row[headerMapping['تاريخ الاستلام']];
      const aidSource = row[headerMapping['مصدر المساعدة']];
      if (aidMemberId && aidType && aidDate && aidSource) {
        rowsToAppend.push(['AID' + registrationDate.getTime() + i, aidMemberId, aidType, parseDateSafe(aidDate, 'تاريخ الاستلام'), aidSource, row[headerMapping['ملاحظات']] || '', registrationDate, admin.username, row[headerMapping['حالة المساعدة']] || 'Completed']);
      }
    });
    if (!rowsToAppend.length) throw new Error('لا يوجد بيانات صالحة للإضافة.');
    aidSheet.getRange(aidSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    logAdminAction(admin.username, 'إضافة مساعدات بالجملة', `تمت إضافة ${rowsToAppend.length} سجل مساعدة.`);
    return { success: true, message: `تمت إضافة ${rowsToAppend.length} سجل مساعدة بنجاح.` };
  } finally {
    if (tempFileId) DriveApp.getFileById(tempFileId).setTrashed(true);
  }
}

function handleUpdateMember(payload) {
  const admin = authenticateToken(payload.token);
  const { memberId, memberData } = payload;
  if (!memberId || !memberData) throw new Error('بيانات التحديث غير مكتملة.');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('رقم الهوية');
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) if (String(data[i][idCol]).trim() == String(memberId).trim()) rowIndex = i + 1;
  if (rowIndex === -1) throw new Error('لم يتم العثور على الفرد.');
  headers.forEach((header, index) => {
    if (memberData.hasOwnProperty(header)) sheet.getRange(rowIndex, index + 1).setValue(memberData[header]);
  });
  logAdminAction(admin.username, 'تعديل بيانات فرد', `تم تعديل بيانات الفرد ${memberId}.`);
  return { success: true, message: 'تم تحديث بيانات الفرد بنجاح.' };
}

function handleGenerateReport(payload) {
  authenticateToken(payload.token);
  const { reportType, filters } = payload;
  if (reportType === 'aidByDateRange') {
    assertRequired(filters || {}, ['startDate', 'endDate']);
    const startDateStr = String(filters.startDate).slice(0, 10);
    const endDateStr = String(filters.endDate).slice(0, 10);
    const aidRecords = sheetToJSON(AID_RECORDS_SHEET);
    const individuals = sheetToJSON(INDIVIDUALS_SHEET);
    const namesMap = individuals.reduce((map, p) => (map[p['رقم الهوية']] = p['الاسم الكامل'], map), {});
    const filteredData = aidRecords.filter(record => {
      if (!record['تاريخ الاستلام']) return false;
      const d = parseDateSafe(record['تاريخ الاستلام'], 'تاريخ الاستلام');
      const dateStr = formatDateISO(d);
      return dateStr >= startDateStr && dateStr <= endDateStr;
    }).map(record => ({ ...record, 'اسم المستفيد': namesMap[record['معرف المستفيد']] || 'غير معروف' }));
    return { success: true, data: filteredData };
  }
  throw new Error('نوع التقرير غير معروف.');
}

function handlePasswordResetRequest(userId) {
  if (!userId) throw new Error('الرجاء إدخال رقم الهوية.');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PASSWORD_RESET_REQUESTS_SHEET);
  sheet.appendRow([new Date(), userId, 'جديد']);
  return { success: true, message: 'تم إرسال طلب إعادة تعيين كلمة المرور.' };
}

function handleGetResetRequests(token) {
  authenticateToken(token);
  return { success: true, data: sheetToJSON(PASSWORD_RESET_REQUESTS_SHEET).filter(r => String(r['الحالة']).trim() === 'جديد') };
}

function handleClearMemberPassword(payload) {
  const admin = authenticateToken(payload.token);
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('رقم الهوية');
  const passCol = headers.indexOf('كلمة المرور (SHA-256)');
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) if (String(data[i][idCol]).trim() === String(payload.userId).trim()) rowIndex = i + 1;
  if (rowIndex === -1) throw new Error('لم يتم العثور على الفرد.');
  sheet.getRange(rowIndex, passCol + 1).setValue('');
  logAdminAction(admin.username, 'محو كلمة مرور فرد', `تم محو كلمة مرور ${payload.userId}.`);
  return { success: true, message: 'تم مسح كلمة المرور بنجاح.' };
}

function handleUpdateAidStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { aidId, newStatus } = payload;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('معرف المساعدة');
  const statusCol = headers.indexOf('حالة المساعدة');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] == aidId) {
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      logAdminAction(admin.username, 'تحديث حالة مساعدة', `تم تحديث حالة ${aidId} إلى ${newStatus}.`);
      return { success: true, message: 'تم تحديث الحالة بنجاح.' };
    }
  }
  throw new Error('لم يتم العثور على سجل المساعدة.');
}

function handleBulkProcessAid(payload) {
  const admin = authenticateToken(payload.token);
  const { beneficiaryIdsToComplete = [], aidRecordsToDelete = [] } = payload;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const benCol = headers.indexOf('معرف المستفيد');
  const statusCol = headers.indexOf('حالة المساعدة');
  const rowsToDelete = [];
  let completedCount = 0, deletedCount = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][benCol]).trim();
    if (String(data[i][statusCol]).trim() === 'Future') {
      if (aidRecordsToDelete.includes(id)) { rowsToDelete.push(i + 1); deletedCount++; }
      else if (beneficiaryIdsToComplete.includes(id)) { sheet.getRange(i + 1, statusCol + 1).setValue('Completed'); completedCount++; }
    }
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) sheet.deleteRow(rowsToDelete[i]);
  logAdminAction(admin.username, 'معالجة مساعدات بالجملة', `تم تسليم ${completedCount} وحذف ${deletedCount}.`);
  return { success: true, message: `تمت العملية بنجاح.` };
}

function handleAddWoundedCase(postData) {
  try {
    const payload = JSON.parse(postData);
    const { fullName, idNumber, phone, familySize, injuryDate, injuryType, injuryCause, needs, notes, medicalReport, injuryPhoto } = payload;
    assertRequired(payload, ['fullName','idNumber','phone','familySize','injuryDate','injuryType','injuryCause','needs','medicalReport']);
    validateUpload(medicalReport);
    if (injuryPhoto && injuryPhoto.data) validateUpload(injuryPhoto, { allowMime: ['image/jpeg', 'image/png'] });
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const uploadFile = (fileObject) => {
      if (fileObject && fileObject.data) {
        const decodedData = Utilities.base64Decode(fileObject.data);
        const blob = Utilities.newBlob(decodedData, fileObject.mimeType, fileObject.name || 'file');
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
      }
      return '';
    };
    const medicalReportUrl = uploadFile(medicalReport);
    const injuryPhotoUrl = uploadFile(injuryPhoto);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WOUNDED_LOG_SHEET);
    sheet.appendRow(['CASE-' + Date.now(), fullName, idNumber, phone, familySize, parseDateSafe(injuryDate, 'injuryDate'), injuryType, injuryCause, medicalReportUrl, needs, notes || '', injuryPhotoUrl, new Date()]);
    return { success: true, message: 'تم إرسال بيانات الحالة بنجاح.' };
  } catch (error) {
    throw new Error(`حدث خطأ: ${error.message}`);
  }
}
