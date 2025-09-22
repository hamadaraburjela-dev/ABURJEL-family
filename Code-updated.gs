/* @file Code.gs
 * @description Backend logic for the Family Aid System.
 * @version 4.3 - Added members management functions with status support.
 */

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_ID = '1EMjJGgjuYDODZZoQ2OqEkHd5JXodqoqSFGu4ROJTwmI'; // تأكد من أن هذا هو المعرف الصحيح لملف جوجل شيتس الخاص بك
const APP_VERSION = '4.3';

const INDIVIDUALS_SHEET = 'الأفراد';
const AID_RECORDS_SHEET = 'المساعدات';
const ADMINS_SHEET = 'المدراء';
const INDIVIDUALS_LOGIN_LOG_SHEET = 'سجل دخول الأفراد';
const ADMINS_LOGIN_LOG_SHEET = 'سجل دخول المدراء';
const ADMIN_ACTIONS_LOG_SHEET = 'سجل عمليات المدراء';
const PASSWORD_RESET_REQUESTS_SHEET = 'طلبات إعادة تعيين';
const SPECIAL_CASES_SHEET = 'حالات خاصة';
const BIRTHS_SHEET = 'مواليد اطفال';
const CHILDREN_CLOTHES_SHEET = 'بنزط اطفال';
const MARTYRS_SHEET = 'الشهداء';

// --- MAIN ENTRY POINTS ---
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
      case 'getUserFutureAid': response = handleGetUserFutureAid(payload.userId, payload.token); break;
      case 'getAdminStats': response = handleGetStats(payload.token); break;
      case 'getAllMembers': response = handleGetAllMembers(payload.token, payload.searchTerm, payload.page, payload.pageSize); break;
      case 'getAdmins': response = handleGetAdmins(payload.token); break;
      case 'getAllAidRecords': response = handleGetAllAidRecords(payload.token); break;
      case 'addAid': response = handleAddAid(payload); break;
      case 'addSpecialCase': response = handleAddSpecialCase(payload); break;
      case 'verifyFatherId': response = handleVerifyFatherId(payload.fatherId); break;
      case 'submitBirthRegistration': response = handleSubmitBirthRegistration(payload); break;
      case 'submitChildrenClothes': response = handleSubmitChildrenClothes(payload); break;
      case 'getBirthRequests': response = handleGetBirthRequests(payload.token); break;
      case 'updateBirthRequestStatus': response = handleUpdateBirthRequestStatus(payload); break;
      case 'verifyMartyrId': response = handleVerifyMartyrId(payload.martyrId); break;
      case 'submitMartyrRegistration': response = handleSubmitMartyrRegistration(payload); break;
      case 'getMartyrRequests': response = handleGetMartyrRequests(payload.token); break;
      case 'updateMartyrRequestStatus': response = handleUpdateMartyrRequestStatus(payload); break;
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
      // دوال إدارة الأعضاء الجديدة
      case 'addMember': response = handleAddMember(payload); break;
      case 'deleteMember': response = handleDeleteMember(payload); break;
      case 'updateMemberStatus': response = handleUpdateMemberStatus(payload); break;
      default:
        response = { success: false, message: 'Unsupported action: ' + payload.action };
    }
    return createJsonResponse(response);
  } catch (error) {
    Logger.log(error);
    return createJsonResponse({ success: false, message: error.message });
  }
}

// --- NEW MEMBERS MANAGEMENT FUNCTIONS ---

/**
 * إضافة عضو جديد
 */
function handleAddMember(payload) {
  const { token, ...memberData } = payload;
  authenticateToken(token);
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  if (!sheet) throw new Error('لم يتم العثور على شيت الأفراد.');
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // التحقق من عدم وجود رقم هوية مكرر
  const idCol = headers.indexOf('رقم الهوية');
  if (idCol === -1) throw new Error('لم يتم العثور على عمود "رقم الهوية".');
  
  const existingIds = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues().flat();
  if (existingIds.includes(memberData['رقم الهوية'])) {
    throw new Error('رقم الهوية موجود بالفعل.');
  }
  
  // إضافة الصف الجديد
  const newRow = headers.map(header => memberData[header] || '');
  sheet.appendRow(newRow);
  
  // تسجيل العملية
  const admin = getAdminByToken(token);
  logAdminAction(admin.username, 'إضافة عضو جديد', `تم إضافة العضو: ${memberData['الاسم الكامل']}`);
  
  return { success: true, message: 'تم إضافة العضو بنجاح.' };
}

/**
 * حذف عضو
 */
function handleDeleteMember(payload) {
  const { token, memberId } = payload;
  authenticateToken(token);
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  if (!sheet) throw new Error('لم يتم العثور على شيت الأفراد.');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('رقم الهوية');
  
  if (idCol === -1) throw new Error('لم يتم العثور على عمود "رقم الهوية".');
  
  // البحث عن العضو
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(memberId).trim()) {
      const memberName = data[i][headers.indexOf('الاسم الكامل')] || 'غير محدد';
      sheet.deleteRow(i + 1);
      
      // تسجيل العملية
      const admin = getAdminByToken(token);
      logAdminAction(admin.username, 'حذف عضو', `تم حذف العضو: ${memberName}`);
      
      return { success: true, message: 'تم حذف العضو بنجاح.' };
    }
  }
  
  throw new Error('لم يتم العثور على العضو المطلوب.');
}

/**
 * تحديث حالة العضو
 */
function handleUpdateMemberStatus(payload) {
  const { token, memberId, status } = payload;
  authenticateToken(token);
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  if (!sheet) throw new Error('لم يتم العثور على شيت الأفراد.');
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('رقم الهوية');
  const statusCol = headers.indexOf('الحالة');
  
  if (idCol === -1) throw new Error('لم يتم العثور على عمود "رقم الهوية".');
  if (statusCol === -1) throw new Error('لم يتم العثور على عمود "الحالة".');
  
  // البحث عن العضو وتحديث حالته
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(memberId).trim()) {
      const memberName = data[i][headers.indexOf('الاسم الكامل')] || 'غير محدد';
      sheet.getRange(i + 1, statusCol + 1).setValue(status);
      
      // تسجيل العملية
      const admin = getAdminByToken(token);
      logAdminAction(admin.username, 'تحديث حالة عضو', `تم تحديث حالة العضو ${memberName} إلى: ${status}`);
      
      return { success: true, message: 'تم تحديث حالة العضو بنجاح.' };
    }
  }
  
  throw new Error('لم يتم العثور على العضو المطلوب.');
}

// ملاحظة: باقي الكود موجود في الملف الأصلي Code.gs
// يجب نسخ هذه الدوال الثلاث إلى نهاية الملف الأصلي
// وإضافة الحالات الثلاث الجديدة في دالة doPost كما هو موضح أعلاه
