/* @file Code.gs
 * @description Backend logic for the Family Aid System.
 * @version 4.2 - Optimized data handling for large datasets and search queries.
 */

// --- GLOBAL CONFIGURATION ---
const SPREADSHEET_ID = '1EMjJGgjuYDODZZoQ2OqEkHd5JXodqoqSFGu4ROJTwmI'; // تأكد من أن هذا هو المعرف الصحيح لملف جوجل شيتس الخاص بك
const APP_VERSION = '4.2';

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
const DEATHS_SHEET = 'الوفيات';
const EDIT_REQUESTS_SHEET = 'طلبات تعديل البيانات';
const NOTIFICATIONS_SHEET = 'الإشعارات';

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
  case 'submitSpecialCaseRequest': response = handleSubmitSpecialCaseRequest(payload); break;
  case 'verifyFatherId': response = handleVerifyFatherId(payload.fatherId); break;
  case 'submitBirthRegistration': response = handleSubmitBirthRegistration(payload); break;
  case 'submitChildrenClothes': response = handleSubmitChildrenClothes(payload); break;
  case 'getBirthRequests': response = handleGetBirthRequests(payload.token); break;
  case 'updateBirthRequestStatus': response = handleUpdateBirthRequestStatus(payload); break;
  case 'verifyMartyrId': response = handleVerifyMartyrId(payload.martyrId); break;
  case 'submitMartyrRegistration': response = handleSubmitMartyrRegistration(payload); break;
  case 'getMartyrRequests': response = handleGetMartyrRequests(payload.token); break;
  case 'getSpecialCaseRequests': response = handleGetSpecialCaseRequests(payload.token); break;
  case 'updateSpecialCaseStatus': response = handleUpdateSpecialCaseStatus(payload); break;
  case 'getDeathRequests': response = handleGetDeathRequests(payload.token); break;
  case 'updateDeathRequestStatus': response = handleUpdateDeathRequestStatus(payload); break;
  case 'updateMartyrRequestStatus': response = handleUpdateMartyrRequestStatus(payload); break;
            case 'submitDeathRegistration': response = handleSubmitDeathRegistration(payload); break;
            case 'submitInjuryRegistration': response = handleSubmitInjuryRegistration(payload); break;
            case 'getInjuryRequests': response = handleGetInjuryRequests(payload.token); break;
            case 'updateInjuryRequestStatus': response = handleUpdateInjuryRequestStatus(payload); break;
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
    case 'updateUserProfile': response = handleUpdateUserProfile(payload.userId, payload.profileData); break;
    case 'submitEditRequest': response = handleSubmitEditRequest(payload); break;
    case 'getUserEditRequests': response = handleGetUserEditRequests(payload.userId); break;
    case 'getAllEditRequests': response = handleGetAllEditRequests(payload.token); break;
    case 'updateEditRequestStatus': response = handleUpdateEditRequestStatus(payload); break;
    case 'getUserNotifications': response = handleGetUserNotifications(payload.userId); break;
    case 'getAdminNotifications': response = handleGetAdminNotifications(payload.token); break;
    case 'markNotificationAsRead': response = handleMarkNotificationAsRead(payload); break;
    case 'markAllNotificationsAsRead': response = handleMarkAllNotificationsAsRead(payload.userId); break;
    case 'markAllAdminNotificationsAsRead': response = handleMarkAllAdminNotificationsAsRead(payload.token); break;
      default:
        response = { success: false, message: 'Unsupported action: ' + payload.action };
    }
    return createJsonResponse(response);
  } catch (error) {
    Logger.log(error);
    return createJsonResponse({ success: false, message: error.message });
  }
}

// --- ACTION HANDLERS ---

/**
 * =================================================================
 * EFFICIENT VERSION of handleGetAllMembers
 * =================================================================
 */
function handleGetAllMembers(token, searchTerm, page, pageSize) {
  authenticateToken(token);
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  if (!sheet) return { success: true, members: [], total: 0 };
  
  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) return { success: true, members: [], total: 0 };

  const headers = allData.shift();
  let rows = allData;

  const nameColIndex = headers.indexOf('الاسم الكامل');
  const idColIndex = headers.indexOf('رقم الهوية');

  if (nameColIndex === -1 || idColIndex === -1) {
    throw new Error('لم يتم العثور على أعمدة "الاسم الكامل" أو "رقم الهوية" في شيت الأفراد.');
  }

  // 1. الفلترة على البيانات الخام (سريع جداً)
  let filteredRows = rows;
  if (searchTerm) {
    const lowerCaseTerm = searchTerm.toLowerCase();
    filteredRows = rows.filter(row =>
      (row[nameColIndex] && row[nameColIndex].toString().toLowerCase().includes(lowerCaseTerm)) ||
      (row[idColIndex] && row[idColIndex].toString().toLowerCase().includes(lowerCaseTerm))
    );
  }

  const total = filteredRows.length;
  const pageNum = parseInt(page, 10) || 1;
  const limit = parseInt(pageSize, 10) || 10;
  const startIndex = (pageNum - 1) * limit;
  
  // 2. تقسيم الصفحات على البيانات المفلترة
  const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);

  // 3. تحويل الجزء الصغير المطلوب فقط إلى JSON
  const pagedMembers = paginatedRows.map(row => {
    const memberObj = {};
    headers.forEach((header, index) => {
      memberObj[header] = row[index];
    });
    return memberObj;
  });

  return { success: true, members: pagedMembers, total: total };
}

/**
 * =================================================================
 * EFFICIENT VERSION of handleGetAllAidRecords
 * =================================================================
 */
function handleGetAllAidRecords(token) {
    authenticateToken(token);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aidSheet = ss.getSheetByName(AID_RECORDS_SHEET);
    const individualsSheet = ss.getSheetByName(INDIVIDUALS_SHEET);

    if (!aidSheet || !individualsSheet) throw new Error('Aid or Individuals sheet not found.');

    const individualsData = individualsSheet.getDataRange().getValues();
    const aidData = aidSheet.getDataRange().getValues();
    if (aidData.length < 2) return { success: true, data: [] };

    const individualsHeaders = individualsData.shift();
    const indIdCol = individualsHeaders.indexOf('رقم الهوية');
    const indNameCol = individualsHeaders.indexOf('الاسم الكامل');
    const namesMap = individualsData.reduce((map, row) => {
        if(row[indIdCol]) {
          map[row[indIdCol]] = row[indNameCol];
        }
        return map;
    }, {});

    const aidHeaders = aidData.shift();
    const beneficiaryIdCol = aidHeaders.indexOf('معرف المستفيد');
    
    const enrichedRecords = aidData.map(row => {
        const recordObj = {};
        aidHeaders.forEach((header, index) => {
            recordObj[header] = row[index];
        });
        recordObj['اسم المستفيد'] = namesMap[row[beneficiaryIdCol]] || 'مستفيد غير معروف';
        return recordObj;
    }).sort((a, b) => {
        const dateA = a['تاريخ التسجيل'] ? new Date(a['تاريخ التسجيل']) : 0;
        const dateB = b['تاريخ التسجيل'] ? new Date(b['تاريخ التسجيل']) : 0;
        return dateB - dateA;
    });

    return { success: true, data: enrichedRecords };
}


// --- OTHER UNCHANGED FUNCTIONS ---
function handleCheckPasswordStatus(id, spouseId) {
  if (!id || !spouseId) {
    throw new Error('يجب إدخال رقم الهوية ورقم هوية الزوجة.');
  }
  const members = sheetToJSON(INDIVIDUALS_SHEET);
  const member = members.find(m => String(m['رقم الهوية']).trim() == String(id).trim() && String(m['رقم هوية الزوجة']).trim() == String(spouseId).trim());
  if (!member) {
    throw new Error('بيانات الدخول غير صحيحة.');
  }
  const storedPassword = member['كلمة المرور (SHA-256)'];
  if (!storedPassword) {
    return { success: true, message: 'password_required', userId: id, userName: member['الاسم الكامل'] };
  }
  return { success: true, message: 'password_exists' };
}

function handleUserLoginWithPassword(id, spouseId, password) {
  const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_LOGIN_LOG_SHEET);
  let logStatus = 'فاشل';
  let logReason = '';

  try {
    if (!id || !spouseId || !password) {
      logReason = 'بيانات غير مكتملة';
      throw new Error('يجب إدخال رقم الهوية ورقم هوية الزوجة وكلمة المرور.');
    }
    const members = sheetToJSON(INDIVIDUALS_SHEET);
    const member = members.find(m => String(m['رقم الهوية']).trim() == String(id).trim() && String(m['رقم هوية الزوجة']).trim() == String(spouseId).trim());
    if (!member) {
      logReason = 'بيانات الدخول غير صحيحة';
      throw new Error('بيانات الدخول غير صحيحة. الرجاء التأكد من أرقام الهوية.');
    }
    const storedPassword = member['كلمة المرور (SHA-256)'];
    if (!storedPassword) {
        logReason = 'لم يتم تعيين كلمة مرور لهذا الحساب بعد.';
        throw new Error('لم يتم تعيين كلمة مرور لهذا الحساب بعد. يرجى البدء من جديد.');
    }
    const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password).map(byte => (byte + 256) % 256).map(b => b.toString(16).padStart(2, '0')).join('');
    if (passwordHash !== storedPassword) {
      logReason = 'كلمة مرور غير صحيحة';
      throw new Error('كلمة المرور غير صحيحة.');
    }
    
    logStatus = 'ناجح';
    return { success: true, user_id: member['رقم الهوية'], user_name: member['الاسم الكامل'] };
  } catch (error) {
    throw error;
  } finally {
    logSheet.appendRow([new Date(), id, spouseId, logStatus, logReason]);
  }
}

function handleSetMemberPassword(userId, password) {
  if (!userId) throw new Error('معرف المستخدم مفقود.');
  if (!password || password.length < 6) throw new Error('كلمة المرور يجب أن لا تقل عن 6 أحرف.');
  
  const individualsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  const data = individualsSheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('رقم الهوية');
  const passwordColIndex = headers.indexOf('كلمة المرور (SHA-256)');
  
  if (idColIndex === -1 || passwordColIndex === -1) {
    throw new Error('أحد الأعمدة المطلوبة مفقود. يرجى التأكد من وجود عمود "كلمة المرور (SHA-256)" في ورقة الأفراد.');
  }
  
  let rowIndexToUpdate = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() == String(userId).trim()) {
      rowIndexToUpdate = i + 1;
      break;
    }
  }
  if (rowIndexToUpdate === -1) throw new Error('لم يتم العثور على الفرد.');
  
  const passwordHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password).map(byte => (byte + 256) % 256).map(b => b.toString(16).padStart(2, '0')).join('');
  individualsSheet.getRange(rowIndexToUpdate, passwordColIndex + 1).setValue(passwordHash);
  
  const individuals = sheetToJSON(INDIVIDUALS_SHEET);
  const member = individuals.find(m => String(m['رقم الهوية']).trim() == String(userId).trim());
  
  return { success: true, message: 'تم حفظ كلمة المرور بنجاح.', userName: member['الاسم الكامل'] };
}

function handleGetUserAidHistory(userId) {
  const aidRecords = sheetToJSON(AID_RECORDS_SHEET);
  // السطر التالي هو التعديل الذي يحل المشكلة
  const userHistory = aidRecords.filter(r => 
    String(r['معرف المستفيد']).trim() == String(userId).trim() && 
    String(r['حالة المساعدة']).trim() === 'Completed' // <-- تمت إضافة هذا الشرط
  );
  return { success: true, data: userHistory };
}

function handleGetUserFutureAid(userId, token) {

  const aidRecords = sheetToJSON(AID_RECORDS_SHEET);
  const userFutureAid = aidRecords.filter(r => String(r['معرف المستفيد']).trim() == String(userId).trim() && String(r['حالة المساعدة']).trim() === 'Future');
  return { success: true, data: userFutureAid };
}

function handleGetUserData(userId) {
  const members = sheetToJSON(INDIVIDUALS_SHEET);
  const memberData = members.find(m => String(m['رقم الهوية']).trim() == String(userId).trim());
  if (!memberData) throw new Error('لم يتم العثور على بيانات المستخدم.');
  return { success: true, data: memberData };
}

function handleUpdateUserProfile(userId, profileData) {
  try {
    if (!userId || !profileData) {
      throw new Error('معرف المستخدم وبيانات الملف الشخصي مطلوبان.');
    }
    
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
    if (!sheet) {
      throw new Error('لم يتم العثور على شيت الأفراد.');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // البحث عن السجل المطلوب تحديثه
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      const idColIndex = headers.indexOf('رقم الهوية');
      if (idColIndex !== -1 && String(values[i][idColIndex]).trim() === String(userId).trim()) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error('لم يتم العثور على المستخدم المطلوب تحديثه.');
    }
    
    // تحديث البيانات
    for (const [fieldName, fieldValue] of Object.entries(profileData)) {
      const colIndex = headers.indexOf(fieldName);
      if (colIndex !== -1 && fieldValue && fieldValue.trim() !== '') {
        values[rowIndex][colIndex] = fieldValue;
      }
    }
    
    // إضافة تاريخ آخر تحديث
    const lastUpdateColIndex = headers.indexOf('آخر تحديث');
    if (lastUpdateColIndex !== -1) {
      values[rowIndex][lastUpdateColIndex] = new Date().toISOString().split('T')[0];
    }
    
    // حفظ التغييرات
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    
    return { 
      success: true, 
      message: 'تم تحديث البيانات الشخصية بنجاح' 
    };
    
  } catch (error) {
    Logger.log('خطأ في تحديث الملف الشخصي: ' + error.message);
    return { 
      success: false, 
      message: 'حدث خطأ في تحديث البيانات: ' + error.message 
    };
  }
}

/**
 * Handle submission of profile edit request
 * @param {Object} payload - Contains userId, userName, userIdNumber, requestedChanges, reason, requestDate, status
 * @returns {Object} Response object
 */
function handleSubmitEditRequest(payload) {
  try {
    const { userId, userName, userIdNumber, requestedChanges, reason, requestDate, status } = payload;
    
    if (!userId || !requestedChanges || !reason) {
      throw new Error('البيانات غير مكتملة: معرف المستخدم والتغييرات المطلوبة والسبب مطلوبون.');
    }

    // التحقق من وجود الشيت أو إنشاؤه
    let editRequestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EDIT_REQUESTS_SHEET);
    
    if (!editRequestsSheet) {
      // إنشاء شيت جديد لطلبات التعديل
      editRequestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(EDIT_REQUESTS_SHEET);
      
      // إضافة الهيدرز
      const headers = [
        'معرف الطلب',
        'رقم الهوية',
        'اسم المستخدم', 
        'تاريخ الطلب',
        'سبب التعديل',
        'التغييرات المطلوبة',
        'الحالة',
        'ملاحظات الإدارة',
        'تاريخ المراجعة',
        'المراجع'
      ];
      editRequestsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // تنسيق الهيدرز
      const headerRange = editRequestsSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#4CAF50');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
    }

    // إنشاء معرف فريد للطلب
    const requestId = 'REQ-' + new Date().getTime();
    
    // تحويل التغييرات المطلوبة إلى نص
    const changesText = Object.entries(requestedChanges)
      .filter(([key, value]) => value && value.trim() !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // إضافة الطلب الجديد
    const newRow = [
      requestId,
      userIdNumber || userId,
      userName || 'غير محدد',
      new Date(requestDate).toLocaleDateString('ar-EG'),
      reason,
      changesText,
      status || 'مُنتظر المراجعة',
      '', // ملاحظات الإدارة
      '', // تاريخ المراجعة
      ''  // المراجع
    ];

    editRequestsSheet.appendRow(newRow);

    // تسجيل العملية في السجل
    Logger.log(`تم إرسال طلب تعديل جديد: ${requestId} للمستخدم: ${userId}`);

    // إنشاء إشعار للأدمن
    createNotification({
      type: 'new_edit_request',
      title: 'طلب تعديل بيانات جديد',
      message: `تم استلام طلب تعديل بيانات جديد من المستخدم: ${userName} (${userIdNumber})`,
      priority: 'high',
      isAdmin: true
    });

    return {
      success: true,
      message: 'تم إرسال طلب التعديل بنجاح. سيتم مراجعته من قبل الإدارة.',
      requestId: requestId
    };

  } catch (error) {
    Logger.log('خطأ في إرسال طلب التعديل: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في إرسال طلب التعديل: ' + error.message
    };
  }
}

/**
 * Handle getting user's edit requests
 * @param {String} userId - User ID to get requests for
 * @returns {Object} Response object with edit requests
 */
function handleGetUserEditRequests(userId) {
  try {
    if (!userId) {
      throw new Error('معرف المستخدم مطلوب');
    }

    const editRequestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EDIT_REQUESTS_SHEET);
    
    if (!editRequestsSheet) {
      return {
        success: true,
        requests: []
      };
    }

    const data = editRequestsSheet.getDataRange().getValues();
    const headers = data[0];
    const requests = [];

    // البحث عن طلبات هذا المستخدم
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userIdColumn = headers.indexOf('رقم الهوية');
      
      if (userIdColumn !== -1 && String(row[userIdColumn]).trim() === String(userId).trim()) {
        const request = {
          requestId: row[headers.indexOf('معرف الطلب')] || '',
          requestDate: row[headers.indexOf('تاريخ الطلب')] || '',
          reason: row[headers.indexOf('سبب التعديل')] || '',
          status: row[headers.indexOf('الحالة')] || 'مُنتظر المراجعة',
          adminNotes: row[headers.indexOf('ملاحظات الإدارة')] || '',
          reviewDate: row[headers.indexOf('تاريخ المراجعة')] || '',
          reviewer: row[headers.indexOf('المراجع')] || ''
        };
        requests.push(request);
      }
    }

    // ترتيب الطلبات حسب التاريخ (الأحدث أولاً)
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

    return {
      success: true,
      requests: requests
    };

  } catch (error) {
    Logger.log('خطأ في جلب طلبات التعديل: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في جلب طلبات التعديل: ' + error.message,
      requests: []
    };
  }
}

/**
 * Handle getting all edit requests (Admin only)
 * @param {String} token - Admin authentication token
 * @returns {Object} Response object with all edit requests
 */
function handleGetAllEditRequests(token) {
  try {
    authenticateToken(token);

    const editRequestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EDIT_REQUESTS_SHEET);
    
    if (!editRequestsSheet) {
      return {
        success: true,
        requests: []
      };
    }

    const data = editRequestsSheet.getDataRange().getValues();
    const headers = data[0];
    const requests = [];

    // تحويل جميع الصفوف إلى كائنات
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const request = {
        requestId: row[headers.indexOf('معرف الطلب')] || '',
        userIdNumber: row[headers.indexOf('رقم الهوية')] || '',
        userName: row[headers.indexOf('اسم المستخدم')] || '',
        requestDate: row[headers.indexOf('تاريخ الطلب')] || '',
        reason: row[headers.indexOf('سبب التعديل')] || '',
        requestedChanges: row[headers.indexOf('التغييرات المطلوبة')] || '',
        status: row[headers.indexOf('الحالة')] || 'مُنتظر المراجعة',
        adminNotes: row[headers.indexOf('ملاحظات الإدارة')] || '',
        reviewDate: row[headers.indexOf('تاريخ المراجعة')] || '',
        reviewer: row[headers.indexOf('المراجع')] || ''
      };
      requests.push(request);
    }

    // ترتيب الطلبات حسب التاريخ (الأحدث أولاً)
    requests.sort((a, b) => {
      const dateA = new Date(a.requestDate);
      const dateB = new Date(b.requestDate);
      return dateB - dateA;
    });

    return {
      success: true,
      requests: requests
    };

  } catch (error) {
    Logger.log('خطأ في جلب جميع طلبات التعديل: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في جلب طلبات التعديل: ' + error.message,
      requests: []
    };
  }
}

/**
 * Handle updating edit request status (Admin only)
 * @param {Object} payload - Contains token, requestId, status, adminNotes, reviewer
 * @returns {Object} Response object
 */
function handleUpdateEditRequestStatus(payload) {
  try {
    const { token, requestId, status, adminNotes, reviewer } = payload;
    
    authenticateToken(token);
    
    if (!requestId || !status) {
      throw new Error('معرف الطلب والحالة الجديدة مطلوبان');
    }

    const editRequestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EDIT_REQUESTS_SHEET);
    
    if (!editRequestsSheet) {
      throw new Error('لم يتم العثور على شيت طلبات التعديل');
    }

    const data = editRequestsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // البحث عن الطلب المحدد
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const requestIdCol = headers.indexOf('معرف الطلب');
      if (requestIdCol !== -1 && String(data[i][requestIdCol]).trim() === String(requestId).trim()) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error('لم يتم العثور على الطلب المحدد');
    }

    // تحديث البيانات
    const statusColIndex = headers.indexOf('الحالة');
    const adminNotesColIndex = headers.indexOf('ملاحظات الإدارة');
    const reviewDateColIndex = headers.indexOf('تاريخ المراجعة');
    const reviewerColIndex = headers.indexOf('المراجع');

    if (statusColIndex !== -1) {
      data[rowIndex][statusColIndex] = status;
    }
    
    if (adminNotesColIndex !== -1) {
      data[rowIndex][adminNotesColIndex] = adminNotes || '';
    }
    
    if (reviewDateColIndex !== -1) {
      data[rowIndex][reviewDateColIndex] = new Date().toLocaleDateString('ar-EG');
    }
    
    if (reviewerColIndex !== -1) {
      data[rowIndex][reviewerColIndex] = reviewer || 'الإدارة';
    }

    // حفظ التغييرات
    editRequestsSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    // إذا تم قبول الطلب، قم بتطبيق التغييرات على بيانات المستخدم
    if (status === 'مقبول') {
      const userIdNumber = data[rowIndex][headers.indexOf('رقم الهوية')];
      const requestedChanges = data[rowIndex][headers.indexOf('التغييرات المطلوبة')];
      
      try {
        applyAcceptedChanges(userIdNumber, requestedChanges);
        
        // إنشاء إشعار للمستخدم
        createNotification({
          userId: userIdNumber,
          type: 'edit_request_approved',
          title: 'تم قبول طلب التعديل',
          message: 'تم قبول طلب تعديل البيانات الشخصية وتطبيق التغييرات بنجاح.',
          priority: 'normal'
        });
      } catch (applyError) {
        Logger.log('خطأ في تطبيق التغييرات: ' + applyError.message);
      }
    } else if (status === 'مرفوض') {
      // إنشاء إشعار للمستخدم عند الرفض
      const userIdNumber = data[rowIndex][headers.indexOf('رقم الهوية')];
      createNotification({
        userId: userIdNumber,
        type: 'edit_request_rejected',
        title: 'تم رفض طلب التعديل',
        message: `تم رفض طلب تعديل البيانات. ${adminNotes ? 'السبب: ' + adminNotes : ''}`,
        priority: 'normal'
      });
    }

    return {
      success: true,
      message: `تم تحديث حالة الطلب إلى: ${status}`
    };

  } catch (error) {
    Logger.log('خطأ في تحديث حالة طلب التعديل: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في تحديث حالة الطلب: ' + error.message
    };
  }
}

/**
 * Apply accepted changes to user data
 * @param {String} userIdNumber - User ID number
 * @param {String} requestedChangesText - Requested changes as text
 */
function applyAcceptedChanges(userIdNumber, requestedChangesText) {
  try {
    const individualsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
    
    if (!individualsSheet) {
      throw new Error('لم يتم العثور على شيت الأفراد');
    }

    const data = individualsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // البحث عن المستخدم
    let userRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const idColIndex = headers.indexOf('رقم الهوية');
      if (idColIndex !== -1 && String(data[i][idColIndex]).trim() === String(userIdNumber).trim()) {
        userRowIndex = i;
        break;
      }
    }
    
    if (userRowIndex === -1) {
      throw new Error('لم يتم العثور على المستخدم في شيت الأفراد');
    }

    // تحليل التغييرات المطلوبة
    const changes = requestedChangesText.split('\n').filter(change => change.trim());
    
    for (const change of changes) {
      const [fieldName, fieldValue] = change.split(':').map(s => s.trim());
      if (fieldName && fieldValue) {
        const colIndex = headers.indexOf(fieldName);
        if (colIndex !== -1) {
          data[userRowIndex][colIndex] = fieldValue;
        }
      }
    }

    // إضافة تاريخ آخر تحديث
    const lastUpdateColIndex = headers.indexOf('آخر تحديث');
    if (lastUpdateColIndex !== -1) {
      data[userRowIndex][lastUpdateColIndex] = new Date().toISOString().split('T')[0];
    }

    // حفظ التغييرات
    individualsSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    Logger.log(`تم تطبيق التغييرات المقبولة للمستخدم: ${userIdNumber}`);

  } catch (error) {
    Logger.log('خطأ في تطبيق التغييرات المقبولة: ' + error.message);
    throw error;
  }
}

/**
 * Create a notification
 * @param {Object} notificationData - Contains userId, type, title, message, priority
 */
function createNotification(notificationData) {
  try {
    const { userId, type, title, message, priority = 'normal', isAdmin = false } = notificationData;
    
    // التحقق من وجود الشيت أو إنشاؤه
    let notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      // إنشاء شيت جديد للإشعارات
      notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(NOTIFICATIONS_SHEET);
      
      // إضافة الهيدرز
      const headers = [
        'معرف الإشعار',
        'معرف المستخدم',
        'نوع الإشعار',
        'العنوان',
        'الرسالة',
        'الأولوية',
        'مقروء',
        'تاريخ الإنشاء',
        'للأدمن',
        'تاريخ القراءة'
      ];
      notificationsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // تنسيق الهيدرز
      const headerRange = notificationsSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#2196F3');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
    }

    // إنشاء معرف فريد للإشعار
    const notificationId = 'NOTIF-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 5);
    
    // إضافة الإشعار الجديد
    const newRow = [
      notificationId,
      userId || '',
      type,
      title,
      message,
      priority,
      false, // مقروء
      new Date().toISOString(),
      isAdmin, // للأدمن
      '' // تاريخ القراءة
    ];

    notificationsSheet.appendRow(newRow);
    
    Logger.log(`تم إنشاء إشعار جديد: ${notificationId} للمستخدم: ${userId}`);
    
    return notificationId;

  } catch (error) {
    Logger.log('خطأ في إنشاء الإشعار: ' + error.message);
    return null;
  }
}

/**
 * Handle getting user notifications
 * @param {String} userId - User ID to get notifications for
 * @returns {Object} Response object with notifications
 */
function handleGetUserNotifications(userId) {
  try {
    if (!userId) {
      throw new Error('معرف المستخدم مطلوب');
    }

    const notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      return {
        success: true,
        notifications: []
      };
    }

    const data = notificationsSheet.getDataRange().getValues();
    const headers = data[0];
    const notifications = [];

    // البحث عن إشعارات هذا المستخدم
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userIdColumn = headers.indexOf('معرف المستخدم');
      const isAdminColumn = headers.indexOf('للأدمن');
      
      if (userIdColumn !== -1 && isAdminColumn !== -1 && 
          String(row[userIdColumn]).trim() === String(userId).trim() &&
          !row[isAdminColumn]) { // فقط الإشعارات غير الخاصة بالأدمن
        
        const notification = {
          id: row[headers.indexOf('معرف الإشعار')] || '',
          type: row[headers.indexOf('نوع الإشعار')] || '',
          title: row[headers.indexOf('العنوان')] || '',
          message: row[headers.indexOf('الرسالة')] || '',
          priority: row[headers.indexOf('الأولوية')] || 'normal',
          isRead: row[headers.indexOf('مقروء')] || false,
          createdAt: row[headers.indexOf('تاريخ الإنشاء')] || '',
          readAt: row[headers.indexOf('تاريخ القراءة')] || ''
        };
        notifications.push(notification);
      }
    }

    // ترتيب الإشعارات حسب التاريخ (الأحدث أولاً)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      notifications: notifications
    };

  } catch (error) {
    Logger.log('خطأ في جلب إشعارات المستخدم: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في جلب الإشعارات: ' + error.message,
      notifications: []
    };
  }
}

/**
 * Handle getting admin notifications
 * @param {String} token - Admin authentication token
 * @returns {Object} Response object with admin notifications
 */
function handleGetAdminNotifications(token) {
  try {
    authenticateToken(token);

    const notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      return {
        success: true,
        notifications: []
      };
    }

    const data = notificationsSheet.getDataRange().getValues();
    const headers = data[0];
    const notifications = [];

    // البحث عن إشعارات الأدمن
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isAdminColumn = headers.indexOf('للأدمن');
      
      if (isAdminColumn !== -1 && row[isAdminColumn]) { // فقط إشعارات الأدمن
        const notification = {
          id: row[headers.indexOf('معرف الإشعار')] || '',
          type: row[headers.indexOf('نوع الإشعار')] || '',
          title: row[headers.indexOf('العنوان')] || '',
          message: row[headers.indexOf('الرسالة')] || '',
          priority: row[headers.indexOf('الأولوية')] || 'normal',
          isRead: row[headers.indexOf('مقروء')] || false,
          createdAt: row[headers.indexOf('تاريخ الإنشاء')] || '',
          readAt: row[headers.indexOf('تاريخ القراءة')] || ''
        };
        notifications.push(notification);
      }
    }

    // ترتيب الإشعارات حسب التاريخ (الأحدث أولاً)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      notifications: notifications
    };

  } catch (error) {
    Logger.log('خطأ في جلب إشعارات الأدمن: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في جلب إشعارات الأدمن: ' + error.message,
      notifications: []
    };
  }
}

/**
 * Handle marking notification as read
 * @param {Object} payload - Contains notificationId and optional token for admin
 * @returns {Object} Response object
 */
function handleMarkNotificationAsRead(payload) {
  try {
    const { notificationId, token } = payload;
    
    if (!notificationId) {
      throw new Error('معرف الإشعار مطلوب');
    }

    // إذا كان هناك token، فهو من الأدمن
    if (token) {
      authenticateToken(token);
    }

    const notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      throw new Error('لم يتم العثور على شيت الإشعارات');
    }

    const data = notificationsSheet.getDataRange().getValues();
    const headers = data[0];
    
    // البحث عن الإشعار المحدد
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const notifIdCol = headers.indexOf('معرف الإشعار');
      if (notifIdCol !== -1 && String(data[i][notifIdCol]).trim() === String(notificationId).trim()) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error('لم يتم العثور على الإشعار المحدد');
    }

    // تحديث حالة القراءة
    const isReadColIndex = headers.indexOf('مقروء');
    const readAtColIndex = headers.indexOf('تاريخ القراءة');

    if (isReadColIndex !== -1) {
      data[rowIndex][isReadColIndex] = true;
    }
    
    if (readAtColIndex !== -1) {
      data[rowIndex][readAtColIndex] = new Date().toISOString();
    }

    // حفظ التغييرات
    notificationsSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    return {
      success: true,
      message: 'تم تمييز الإشعار كمقروء'
    };

  } catch (error) {
    Logger.log('خطأ في تمييز الإشعار كمقروء: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في تمييز الإشعار كمقروء: ' + error.message
    };
  }
}

/**
 * Handle marking all user notifications as read
 * @param {String} userId - User ID
 * @returns {Object} Response object
 */
function handleMarkAllNotificationsAsRead(userId) {
  try {
    if (!userId) {
      throw new Error('معرف المستخدم مطلوب');
    }

    const notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      return { success: true, message: 'لا توجد إشعارات' };
    }

    const data = notificationsSheet.getDataRange().getValues();
    const headers = data[0];
    let updatedCount = 0;

    // تحديث جميع إشعارات المستخدم
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userIdColumn = headers.indexOf('معرف المستخدم');
      const isAdminColumn = headers.indexOf('للأدمن');
      const isReadColumn = headers.indexOf('مقروء');
      const readAtColumn = headers.indexOf('تاريخ القراءة');
      
      if (userIdColumn !== -1 && isAdminColumn !== -1 && isReadColumn !== -1 &&
          String(row[userIdColumn]).trim() === String(userId).trim() &&
          !row[isAdminColumn] && !row[isReadColumn]) {
        
        data[i][isReadColumn] = true;
        if (readAtColumn !== -1) {
          data[i][readAtColumn] = new Date().toISOString();
        }
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      // حفظ التغييرات
      notificationsSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    return {
      success: true,
      message: `تم تمييز ${updatedCount} إشعار كمقروء`
    };

  } catch (error) {
    Logger.log('خطأ في تمييز جميع الإشعارات كمقروءة: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في تمييز الإشعارات كمقروءة: ' + error.message
    };
  }
}

/**
 * Handle marking all admin notifications as read
 * @param {String} token - Admin authentication token
 * @returns {Object} Response object
 */
function handleMarkAllAdminNotificationsAsRead(token) {
  try {
    authenticateToken(token);

    const notificationsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOTIFICATIONS_SHEET);
    
    if (!notificationsSheet) {
      return { success: true, message: 'لا توجد إشعارات' };
    }

    const data = notificationsSheet.getDataRange().getValues();
    const headers = data[0];
    let updatedCount = 0;

    // تحديث جميع إشعارات الأدمن
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isAdminColumn = headers.indexOf('للأدمن');
      const isReadColumn = headers.indexOf('مقروء');
      const readAtColumn = headers.indexOf('تاريخ القراءة');
      
      if (isAdminColumn !== -1 && isReadColumn !== -1 &&
          row[isAdminColumn] && !row[isReadColumn]) {
        
        data[i][isReadColumn] = true;
        if (readAtColumn !== -1) {
          data[i][readAtColumn] = new Date().toISOString();
        }
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      // حفظ التغييرات
      notificationsSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    return {
      success: true,
      message: `تم تمييز ${updatedCount} إشعار كمقروء`
    };

  } catch (error) {
    Logger.log('خطأ في تمييز جميع إشعارات الأدمن كمقروءة: ' + error.message);
    return {
      success: false,
      message: 'حدث خطأ في تمييز إشعارات الأدمن كمقروءة: ' + error.message
    };
  }
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
// في ملف Code.gs
function handleGetStats(token) {
  authenticateToken(token);
  const individuals = sheetToJSON(INDIVIDUALS_SHEET);
  const aidRecords = sheetToJSON(AID_RECORDS_SHEET);
  
  // --- حساب الإحصائيات الأساسية ---
  const childrenCountCol = 'عدد الأولاد';
  let totalIndividuals = 0;
  individuals.forEach(p => {
    totalIndividuals += (Number(p[childrenCountCol]) || 0);
  });
  const totalFamilies = individuals.length;
  const totalAid = aidRecords.length;

  // --- حساب الإحصائيات الجديدة ---
  const divorcedCount = individuals.filter(p => p['الحالة الاجتماعية'] === 'مطلقة').length;
  const martyrsCount = individuals.filter(p => p['الحالة الخاصة'] === 'شهيد').length;
  const woundedCount = individuals.filter(p => p['الحالة الخاصة'] === 'جريح').length;
  
  const ahmadBranchCount = individuals.filter(p => p['الفرع'] === 'ال احمد').length;
  const hamedBranchCount = individuals.filter(p => p['الفرع'] === 'ال حامد').length;
  const hamdanBranchCount = individuals.filter(p => p['الفرع'] === 'ال حمدان').length;
  const hammadBranchCount = individuals.filter(p => p['الفرع'] === 'ال حماد').length;

  return { 
    success: true, 
    stats: { 
      totalIndividuals: totalIndividuals, 
      totalAid: totalAid, 
      totalFamilies: totalFamilies,
      // إضافة الإحصائيات الجديدة للنتيجة
      divorced: divorcedCount,
      martyrs: martyrsCount,
      wounded: woundedCount,
      branchAhmad: ahmadBranchCount,
      branchHamed: hamedBranchCount,
      branchHamdan: hamdanBranchCount,
      branchHammad: hammadBranchCount
    } 
  };
}

function handleAddAid(payload) {
  const admin = authenticateToken(payload.token);
  if (!payload.aidMemberId || !payload.aidType || !payload.aidDate || !payload.aidSource) {
    throw new Error('الرجاء تعبئة جميع الحقول المطلوبة.');
  }
  const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
  const newRecordId = 'AID' + new Date().getTime();
  aidSheet.appendRow([newRecordId, payload.aidMemberId, payload.aidType, payload.aidDate, payload.aidSource, payload.aidNotes || '', new Date(), admin.username, payload.aidStatus]);
  logAdminAction(admin.username, 'إضافة مساعدة فردية', `تمت إضافة مساعدة من نوع ${payload.aidType} للمستفيد ${payload.aidMemberId}.`);
  
  // إنشاء إشعار للمستخدم عند إضافة مساعدة
  createNotification({
    userId: payload.aidMemberId,
    type: 'aid_received',
    title: 'تم إضافة مساعدة جديدة',
    message: `تم إضافة مساعدة من نوع "${payload.aidType}" من مصدر "${payload.aidSource}" إلى حسابك.`,
    priority: 'normal'
  });
  
  return { success: true, message: 'تمت إضافة المساعدة بنجاح!' };
}function handleBulkAddAidFromXLSX(payload) {
  const admin = authenticateToken(payload.token);
  const fileContent = payload.fileContent;
  if (!fileContent) throw new Error('محتوى الملف مفقود.');

  let tempFileId = null;
  try {
    const bytes = Utilities.base64Decode(fileContent);
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
      if (index === -1) {
        throw new Error(`عمود "${expectedHeader}" مفقود في الملف. يرجى استخدام القالب الصحيح.`);
      }
      headerMapping[expectedHeader] = index;
    });

    const rowsToAppend = [];
    const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
    const registrationDate = new Date();

    data.forEach((row, index) => {
      const aidMemberId = row[headerMapping['معرف المستفيد']];
      const aidType = row[headerMapping['نوع المساعدة']];
      const aidDate = row[headerMapping['تاريخ الاستلام']];
      const aidSource = row[headerMapping['مصدر المساعدة']];
      const aidNotes = row[headerMapping['ملاحظات']] || '';
      const aidStatus = row[headerMapping['حالة المساعدة']] || 'Completed';
      
      if (aidMemberId && aidType && aidDate && aidSource) {
        const uniqueId = `AID${registrationDate.getTime()}${index}`;
        rowsToAppend.push([uniqueId, aidMemberId, aidType, new Date(aidDate), aidSource, aidNotes, registrationDate, admin.username, aidStatus]);
      }
    });

    if (rowsToAppend.length === 0) throw new Error('البيانات في الملف غير مكتملة أو غير صالحة.');
    
    const lastRow = aidSheet.getLastRow();
    aidSheet.getRange(lastRow + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    
    logAdminAction(admin.username, 'إضافة مساعدات بالجملة', `تمت إضافة ${rowsToAppend.length} سجل مساعدة من ملف XLSX.`);
    
    return { success: true, message: `تمت إضافة ${rowsToAppend.length} سجل مساعدة بنجاح!` };
    
  } catch (error) {
    throw new Error(`خطأ في معالجة الملف: ${error.message}`);
  } finally {
    if (tempFileId) {
      DriveApp.getFileById(tempFileId).setTrashed(true);
    }
  }
}

function handleGetAdmins(token) {
  authenticateToken(token, 'superadmin');
  const admins = sheetToJSON(ADMINS_SHEET);
  const safeAdmins = admins.map(({ ['كلمة المرور (SHA-256)']: _, ...rest }) => rest);
  return { success: true, admins: safeAdmins };
}

function handleCreateAdmin(payload) {
  const admin = authenticateToken(payload.token, 'superadmin');
  if (!payload.username || !payload.password || !payload.role) {
    throw new Error('الرجاء تعبئة جميع الحقول لإنشاء مدير جديد.');
  }
  const adminSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ADMINS_SHEET);
  const existingAdmins = sheetToJSON(ADMINS_SHEET);
  const userExists = existingAdmins.some(u => String(u['اسم المستخدم']).toLowerCase() === payload.username.toLowerCase());
  if (userExists) throw new Error('اسم المستخدم هذا موجود بالفعل.');
  adminSheet.appendRow([payload.username, payload.password, payload.role, new Date(), 'Active']);
  logAdminAction(admin.username, 'إنشاء مدير جديد', `تم إنشاء حساب للمدير ${payload.username} بصلاحية ${payload.role}.`);
  return { success: true, message: 'تم إنشاء حساب المدير بنجاح.' };
}

function handleUpdateAdminStatus(payload) {
  const admin = authenticateToken(payload.token, 'superadmin');
  const { username, newStatus } = payload;
  if (!username || !newStatus || !['Active', 'Inactive'].includes(newStatus)) {
    throw new Error('بيانات غير مكتملة أو حالة غير صالحة لتحديث المدير.');
  }
  const adminSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ADMINS_SHEET);
  const data = adminSheet.getDataRange().getValues();
  const headers = data[0];
  const usernameColIndex = headers.indexOf('اسم المستخدم');
  const statusColIndex = headers.indexOf('الحالة');
  if (usernameColIndex === -1 || statusColIndex === -1) throw new Error('لم يتم العثور على أعمدة ضرورية في شيت المدراء.');
  
  let rowIndexToUpdate = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameColIndex] == username) {
      rowIndexToUpdate = i + 1;
      break;
    }
  }
  if (rowIndexToUpdate === -1) throw new Error('لم يتم العثور على المدير المطلوب.');
  adminSheet.getRange(rowIndexToUpdate, statusColIndex + 1).setValue(newStatus);
  logAdminAction(admin.username, 'تحديث حالة مدير', `تم تحديث حالة المدير ${username} إلى ${newStatus}.`);
  return { success: true, message: `تم تحديث حالة ${username} إلى ${newStatus}` };
}

function handleUpdateMember(payload) {
  const admin = authenticateToken(payload.token);
  const { memberId, memberData } = payload;
  if (!memberId || !memberData) throw new Error('بيانات التحديث غير مكتملة.');
  
  const individualsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
  const data = individualsSheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('رقم الهوية');
  
  let rowIndexToUpdate = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColIndex]).trim() == String(memberId).trim()) {
      rowIndexToUpdate = i + 1;
      break;
    }
  }
  if (rowIndexToUpdate === -1) throw new Error('لم يتم العثور على الفرد المطلوب.');

  headers.forEach((header, index) => {
    if (memberData.hasOwnProperty(header)) {
      individualsSheet.getRange(rowIndexToUpdate, index + 1).setValue(memberData[header]);
    }
  });
  logAdminAction(admin.username, 'تعديل بيانات فرد', `تم تعديل بيانات الفرد الذي يحمل رقم الهوية ${memberId}.`);
  return { success: true, message: 'تم تحديث بيانات الفرد بنجاح!' };
}

function handleGenerateReport(payload) {
  authenticateToken(payload.token);
  const { reportType, filters } = payload;

  if (reportType === 'aidByDateRange') {
    if (!filters.startDate || !filters.endDate) {
      throw new Error('يجب تحديد تاريخ البدء والانتهاء.');
    }
    const startDateStr = filters.startDate;
    const endDateStr = filters.endDate;

    const aidRecords = sheetToJSON(AID_RECORDS_SHEET);
    const individuals = sheetToJSON(INDIVIDUALS_SHEET);
    
    const namesMap = individuals.reduce((map, person) => {
      map[person['رقم الهوية']] = person['الاسم الكامل'];
      return map;
    }, {});

    const filteredData = aidRecords
      .filter(record => {
        if (!record['تاريخ الاستلام']) return false;
        const recordDateObj = new Date(record['تاريخ الاستلام']);
        if (isNaN(recordDateObj.getTime())) return false;
        
        const recordYear = recordDateObj.getFullYear();
        const recordMonth = String(recordDateObj.getMonth() + 1).padStart(2, '0');
        const recordDay = String(recordDateObj.getDate()).padStart(2, '0');
        const recordDateStr = `${recordYear}-${recordMonth}-${recordDay}`;

        return recordDateStr >= startDateStr && recordDateStr <= endDateStr;
      })
      .map(record => ({
        ...record,
        'اسم المستفيد': namesMap[record['معرف المستفيد']] || 'غير معروف'
      }));
      
    return { success: true, data: filteredData };
  }
  
  throw new Error('نوع التقرير غير معروف.');
}

function handlePasswordResetRequest(userId) {
  if (!userId) throw new Error('الرجاء إدخال رقم الهوية.');
  const requestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PASSWORD_RESET_REQUESTS_SHEET);
  if (!requestsSheet) throw new Error('ورقة "طلبات إعادة تعيين" غير موجودة.');
  requestsSheet.appendRow([new Date(), userId, 'جديد']);
  
  // Send notification to admin
  createNotification(
    null, // admin notification
    'طلب إعادة تعيين كلمة مرور جديد',
    `طلب إعادة تعيين كلمة مرور للفرد ${userId}`,
    'عادي'
  );
  
  return { success: true, message: 'تم إرسال طلب إعادة تعيين كلمة المرور. سيقوم المسؤول بالتعامل معه قريباً.' };
}function handleGetResetRequests(token) {
  authenticateToken(token);
  const requestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PASSWORD_RESET_REQUESTS_SHEET);
  if (!requestsSheet) return { success: true, data: [] };
  const requests = sheetToJSON(PASSWORD_RESET_REQUESTS_SHEET).filter(req => String(req['الحالة']).trim() === 'جديد');
  return { success: true, data: requests };
}

function handleClearMemberPassword(payload) {
    const admin = authenticateToken(payload.token);
    const { userId, timestamp } = payload;
    if (!userId) throw new Error('بيانات غير مكتملة.');

    const individualsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
    const individualsData = individualsSheet.getDataRange().getValues();
    const headers = individualsData[0];
    const idColIndex = headers.indexOf('رقم الهوية');
    const passwordColIndex = headers.indexOf('كلمة المرور (SHA-256)');

    if (idColIndex === -1 || passwordColIndex === -1) {
        throw new Error('أحد الأعمدة المطلوبة مفقود.');
    }

    let rowIndexToUpdate = -1;
    for (let i = 1; i < individualsData.length; i++) {
        if (String(individualsData[i][idColIndex]).trim() === String(userId).trim()) {
            rowIndexToUpdate = i + 1;
            break;
        }
    }

    if (rowIndexToUpdate === -1) {
        throw new Error('لم يتم العثور على الفرد.');
    }

    individualsSheet.getRange(rowIndexToUpdate, passwordColIndex + 1).setValue('');

    const logMessage = timestamp
        ? `قام بمسح كلمة مرور الفرد ${userId} بناءً على طلب إعادة تعيين.`
        : `قام بمسح كلمة مرور الفرد ${userId} بشكل مباشر من لوحة التحكم.`;
    logAdminAction(admin.username, 'محو كلمة مرور فرد', logMessage);

    if (timestamp) {
        const requestsSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PASSWORD_RESET_REQUESTS_SHEET);
        if (requestsSheet) {
            const requestsData = requestsSheet.getDataRange().getValues();
            const requestsHeaders = requestsData[0];
            const idCol = requestsHeaders.indexOf('رقم الهوية');
            const dateCol = requestsHeaders.indexOf('التاريخ والوقت');
            const statusCol = requestsHeaders.indexOf('الحالة');

            for (let i = 1; i < requestsData.length; i++) {
                if (String(requestsData[i][idCol]).trim() === String(userId).trim() && requestsData[i][dateCol].getTime() === new Date(timestamp).getTime()) {
                    requestsSheet.getRange(i + 1, statusCol + 1).setValue('تم التعامل معه');
                    
                    // Send notification to user about password reset completion
                    createNotification(
                        userId,
                        'تم إعادة تعيين كلمة المرور',
                        'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.',
                        'مهم'
                    );
                    
                    break;
                }
            }
        }
    }    return { success: true, message: 'تم محو كلمة المرور بنجاح. يمكن للفرد الآن تعيين كلمة مرور جديدة.' };
}

function handleUpdateAidStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { aidId, newStatus } = payload;
  if (!aidId || !newStatus) throw new Error('بيانات غير مكتملة لتحديث الحالة.');

  const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
  const data = aidSheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf('معرف المساعدة');
  const statusColIndex = headers.indexOf('حالة المساعدة');

  if (idColIndex === -1 || statusColIndex === -1) throw new Error('لم يتم العثور على أعمدة ضرورية في شيت المساعدات.');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] == aidId) {
      aidSheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
      logAdminAction(admin.username, 'تحديث حالة مساعدة', `تم تحديث حالة المساعدة ${aidId} إلى ${newStatus}.`);
      return { success: true, message: 'تم تحديث الحالة بنجاح!' };
    }
  }
  throw new Error('لم يتم العثور على سجل المساعدة.');
}

function handleBulkProcessAid(payload) {
    const admin = authenticateToken(payload.token);
    const { beneficiaryIdsToComplete, aidRecordsToDelete } = payload;

    const aidSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(AID_RECORDS_SHEET);
    const data = aidSheet.getDataRange().getValues();
    const headers = data[0];
    const beneficiaryIdCol = headers.indexOf('معرف المستفيد');
    const statusCol = headers.indexOf('حالة المساعدة');

    let completedCount = 0;
    let deletedCount = 0;
    const rowsToDelete = [];

    for (let i = 1; i < data.length; i++) {
        const rowBeneficiaryId = String(data[i][beneficiaryIdCol]).trim();
        const currentStatus = String(data[i][statusCol]).trim();

        if (currentStatus === 'Future') {
            if (aidRecordsToDelete.includes(rowBeneficiaryId)) {
                rowsToDelete.push(i + 1);
                deletedCount++;
            } else if (beneficiaryIdsToComplete.includes(rowBeneficiaryId)) {
                aidSheet.getRange(i + 1, statusCol + 1).setValue('Completed');
                completedCount++;
            }
        }
    }

    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        aidSheet.deleteRow(rowsToDelete[i]);
    }

    logAdminAction(admin.username, 'معالجة المساعدات بالجملة', `تم تسليم ${completedCount} مساعدة وحذف ${deletedCount} مساعدة.`);
    return { success: true, message: `اكتملت العملية: تم التسليم لـ ${completedCount} وحذف ${deletedCount}.` };
}


// --- UTILITY FUNCTIONS ---
function sheetToJSON(sheetName) {
  try {
    Logger.log('sheetToJSON called for sheet: ' + sheetName);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('Sheet not found: ' + sheetName);
      return [];
    }
    const values = sheet.getDataRange().getValues();
    Logger.log('Sheet data rows: ' + values.length);
    if (values.length < 2) {
      Logger.log('Not enough data rows in sheet');
      return [];
    }
    const headers = values.shift().map(header => header.trim());
    Logger.log('Headers: ' + JSON.stringify(headers));
    const result = values.map(row =>
      headers.reduce((obj, header, i) => {
        obj[header] = row[i];
        return obj;
      }, {})
    );
    Logger.log('Returning ' + result.length + ' records');
    return result;
  } catch (error) {
    Logger.log('Error in sheetToJSON: ' + error.toString());
    return [];
  }
}function authenticateToken(token, requiredRole = null) {
  if (!token) throw new Error('Token is missing.');
  const cache = CacheService.getScriptCache();
  const storedData = cache.get(token);
  if (!storedData) throw new Error('جلسة غير صالحة أو منتهية الصلاحية. الرجاء تسجيل الدخول مرة أخرى.');
  const admin = JSON.parse(storedData);
  if (requiredRole && admin.role !== 'superadmin' && admin.role !== requiredRole) {
    throw new Error('ليس لديك الصلاحية الكافية للقيام بهذا الإجراء.');
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
  if (logSheet) {
    logSheet.appendRow([new Date(), username, actionType, details]);
  }
}

/**
 * Handle submission of a special case from the public site.
 * Expects payload to contain: name, idNumber, phone, caseType, priority, date, notes
 */
function handleAddSpecialCase(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SPECIAL_CASES_SHEET) || ss.insertSheet(SPECIAL_CASES_SHEET);
    // Ensure header exists
    const headers = sheet.getDataRange().getValues();
    if (!headers || headers.length === 0) {
      sheet.appendRow(['تاريخ الإرسال', 'اسم المعني', 'رقم الهوية', 'رقم الجوال', 'نوع الحالة', 'الأولوية', 'تاريخ الحالة', 'ملاحظات', 'حالة']);
    }
    const row = [ new Date(), payload.name || '', payload.idNumber || '', payload.phone || '', payload.caseType || '', payload.priority || '', payload.date || '', payload.notes || '', 'Open' ];
    sheet.appendRow(row);
    return { success: true, message: 'تم استلام الحالة الخاصة وسيتم متابعتها.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Handle public submission of a special case (from special-cases-form.html)
 * payload expected: { user_id, user_name, spouse_id, head_id, case_type, description, case_date, attachment?: { name, mime, data(Base64) } }
 */
function handleSubmitSpecialCaseRequest(payload) {
  try {
    if (!payload || !payload.user_id) {
      throw new Error('رقم الهوية مطلوب لإرسال طلب الحالة الخاصة.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SPECIAL_CASES_SHEET) || ss.insertSheet(SPECIAL_CASES_SHEET);

    // Ensure header exists (use the exact headers provided by admin)
    const rangeValues = sheet.getDataRange().getValues();
    if (!rangeValues || rangeValues.length === 0) {
      sheet.appendRow(['معرف الطلب','تاريخ التسجيل','رقم مقدم الطلب','اسم مقدم الطلب','معرف رب الأسرة','نوع الحالة','تاريخ الحالة','وصف الحالة','رابط المرفق','حالة','ملاحظات الإدارة','مُدخل الطلب','آخر تحديث بواسطة','تاريخ آخر تحديث']);
    }

    // Try to upload attachment if provided
    let fileUrl = '';
    try {
      if (payload.attachment && payload.attachment.data) {
        const bytes = Utilities.base64Decode(payload.attachment.data);
        const blob = Utilities.newBlob(bytes, payload.attachment.mime || payload.attachment.mimeType || MimeType.PLAIN_TEXT, payload.attachment.name || ('attachment_' + new Date().getTime()));
        const folderName = 'مرفقات الحالات الخاصة';
        let folderIter = DriveApp.getFoldersByName(folderName);
        let folder = folderIter.hasNext() ? folderIter.next() : DriveApp.createFolder(folderName);
        const file = folder.createFile(blob);
        file.setName((payload.user_id || 'user') + '_' + (payload.attachment.name || 'attachment') + '_' + new Date().getTime());
        fileUrl = file.getUrl();
      }
    } catch (fileErr) {
      Logger.log('Failed to upload special-case attachment: ' + fileErr);
    }

    const requestId = 'SC' + new Date().getTime();
    // Determine initial status based on head verification
    let status = 'جديد';
    if (payload.head_id) {
      try {
        const members = sheetToJSON(INDIVIDUALS_SHEET);
        const found = members.find(m => String(m['رقم الهوية']).trim() === String(payload.head_id).trim());
        if (!found) status = 'قيد المراجعة';
      } catch (e) {
        status = 'قيد المراجعة';
      }
    }

    // Compose description: include spouse id if provided (no dedicated column in sheet)
    let description = payload.description || '';
    if (payload.spouse_id) {
      description = (description ? description + ' | ' : '') + `هوية الزوج/الزوجة: ${payload.spouse_id}`;
    }

    // Append row following the exact header order provided by admin
    sheet.appendRow([
      requestId,
      new Date(),
      payload.user_id || '',
      payload.user_name || '',
      payload.head_id || '',
      payload.case_type || '',
      payload.case_date ? new Date(payload.case_date) : '',
      description || '',
      fileUrl || '',
      status,
      '', // ملاحظات الإدارة
      payload.user_id || '', // مُدخل الطلب
      '', // آخر تحديث بواسطة
      ''  // تاريخ آخر تحديث
    ]);

    // Send notification to admin
    createNotification(
      null, // admin notification
      'طلب حالة خاصة جديد',
      `طلب حالة خاصة من ${payload.user_name || payload.user_id}: ${payload.case_type || 'غير محدد'}`,
      'عادي'
    );

    return { success: true, message: 'تم استلام طلب الحالة الخاصة وسيتم متابعته.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * تحقق من رقم هوية الأب إن كان موجوداً في شيت الأفراد
 */
function handleVerifyFatherId(fatherId) {
  if (!fatherId) throw new Error('رقم هوية الأب مفقود.');
  const members = sheetToJSON(INDIVIDUALS_SHEET);
  const member = members.find(m => String(m['رقم الهوية']).trim() === String(fatherId).trim());
  return { success: true, exists: !!member, fatherName: member ? member['الاسم الكامل'] : null };
}

/**
 * استلام تسجيل مولود جديد مع رفع شهادة الميلاد كدليل
 * payload: { fatherID, babyName, babyID, birthDate, birthCertificate: { name, mimeType, data(Base64) } }
 */
function handleSubmitBirthRegistration(payload) {
  const { fatherID, babyName, babyID, birthDate, birthCertificate } = payload;
  if (!fatherID || !babyName || !babyID || !birthDate) {
    throw new Error('جميع الحقول مطلوبة: هوية الأب، اسم المولود، هوية المولود، تاريخ الميلاد');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(BIRTHS_SHEET) || ss.insertSheet(BIRTHS_SHEET);

  // إنشاء العناوين إن لم تكن موجودة
  const rangeValues = sheet.getDataRange().getValues();
  if (!rangeValues || rangeValues.length === 0) {
    sheet.appendRow(['معرف الطلب', 'تاريخ الإرسال', 'رقم هوية الأب', 'اسم الأب', 'اسم المولود', 'رقم هوية المولود', 'تاريخ ميلاد المولود', 'حالة الطلب', 'رابط الملف']);
  }

  // التحقق من الأب
  const verifyRes = handleVerifyFatherId(fatherID);
  const fatherExists = verifyRes.exists;
  const fatherName = verifyRes.fatherName || '';

  // رفع الملف إلى جوجل درايف إن وُجد
  let fileUrl = '';
  try {
    if (birthCertificate && birthCertificate.data) {
      const bytes = Utilities.base64Decode(birthCertificate.data);
      const blob = Utilities.newBlob(bytes, birthCertificate.mimeType || MimeType.JPEG, birthCertificate.name || `BirthCertificate_${babyID || ''}.bin`);
      // وضع الملف داخل مجلد مخصص إن وُجد/أُنشئ
      const folderName = 'شهادات المواليد';
      let folder;
      const it = DriveApp.getFoldersByName(folderName);
      folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
      const file = folder.createFile(blob);
      file.setName(`شهادة_ميلاد_${babyID || ''}_${new Date().getTime()}`);
      fileUrl = file.getUrl();
    }
  } catch (fileErr) {
    // لا نوقف العملية بسبب فشل الرفع، فقط نسجل بدون رابط
    Logger.log('File upload failed: ' + fileErr);
  }

  const requestId = 'BIRTH' + new Date().getTime();
  const status = fatherExists ? 'جديد' : 'قيد المراجعة';
  sheet.appendRow([requestId, new Date(), fatherID, fatherName, babyName, babyID, new Date(birthDate), status, fileUrl]);

  // إنشاء إشعار للأدمن عن طلب مولود جديد
  createNotification({
    type: 'new_birth_request',
    title: 'طلب تسجيل مولود جديد',
    message: `تم استلام طلب تسجيل مولود باسم "${babyName}" من الوالد "${fatherName}" (${fatherID})`,
    priority: 'high',
    isAdmin: true
  });

  return { success: true, message: fatherExists ? 'تم إرسال طلب تسجيل المولود.' : 'تم إرسال الطلب للمراجعة بسبب عدم العثور على الأب في السجلات.' };
}

/**
 * إرجاع طلبات المواليد للإدارة
 */
function handleGetBirthRequests(token) {
  authenticateToken(token);
  const rows = sheetToJSON(BIRTHS_SHEET);
  // ترتيب تنازلي حسب التاريخ
  const sorted = rows.sort((a, b) => new Date(b['تاريخ الإرسال']) - new Date(a['تاريخ الإرسال']));
  return { success: true, data: sorted };
}

/**
 * تحديث حالة طلب مولود
 * payload: { token, requestId, newStatus }
 */
function handleUpdateBirthRequestStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error('بيانات غير مكتملة لتحديث حالة الطلب.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BIRTHS_SHEET);
  if (!sheet) throw new Error('ورقة "مواليد اطفال" غير موجودة.');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('لا توجد طلبات.');
  const headers = data[0];
  const idCol = headers.indexOf('معرف الطلب');
  const statusCol = headers.indexOf('حالة الطلب');
  if (idCol === -1 || statusCol === -1) throw new Error('أعمدة الطلب غير صحيحة.');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(requestId).trim()) {
      const fatherIdCol = headers.indexOf('رقم هوية الأب');
      const babyNameCol = headers.indexOf('اسم المولود');
      const fatherId = data[i][fatherIdCol];
      const babyName = data[i][babyNameCol];
      
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      logAdminAction(admin.username, 'تحديث حالة طلب مولود', `تم تحديث ${requestId} إلى ${newStatus}`);
      
      // إنشاء إشعار للمستخدم عن تحديث حالة طلب المولود
      let notificationMessage = '';
      let notificationType = '';
      
      if (newStatus === 'مقبول') {
        notificationMessage = `تم قبول طلب تسجيل المولود "${babyName}". سيتم إضافته إلى النظام قريباً.`;
        notificationType = 'birth_request_approved';
      } else if (newStatus === 'مرفوض') {
        notificationMessage = `تم رفض طلب تسجيل المولود "${babyName}". يرجى مراجعة الإدارة للمزيد من التفاصيل.`;
        notificationType = 'birth_request_rejected';
      } else {
        notificationMessage = `تم تحديث حالة طلب تسجيل المولود "${babyName}" إلى: ${newStatus}`;
        notificationType = 'birth_request_updated';
      }
      
      createNotification({
        userId: fatherId,
        type: notificationType,
        title: 'تحديث حالة طلب المولود',
        message: notificationMessage,
        priority: 'normal'
      });
      
      return { success: true, message: 'تم تحديث حالة الطلب.' };
    }
  }
  throw new Error('لم يتم العثور على الطلب المطلوب.');
}

/**
 * استلام طلب "بنزط أطفال" (ملابس) من الموقع العام
 * payload: { idNumber, fullName, phone, address, childrenCount, sizesDetails, priority, notes, attachment?: { name, mimeType, data(Base64) } }
 */
function handleSubmitChildrenClothes(payload) {
  const { idNumber, fullName, phone, address, childrenCount, sizesDetails, priority, notes, attachment } = payload || {};
  if (!idNumber || !fullName || !phone || !childrenCount) {
    throw new Error('الحقول المطلوبة: رقم الهوية، الاسم الكامل، رقم الجوال، عدد الأطفال');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CHILDREN_CLOTHES_SHEET) || ss.insertSheet(CHILDREN_CLOTHES_SHEET);

  // إنشاء العناوين إن لم تكن موجودة
  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    sheet.appendRow(['معرف الطلب','تاريخ الإرسال','رقم الهوية','الاسم الكامل','رقم الجوال','مكان الإقامة','عدد الأطفال','تفاصيل المقاسات','الأولوية','ملاحظات','حالة الطلب','رابط الملف']);
  }

  // رفع الملف الاختياري إلى Google Drive
  let fileUrl = '';
  try {
    if (attachment && attachment.data) {
      const bytes = Utilities.base64Decode(attachment.data);
      const blob = Utilities.newBlob(bytes, attachment.mimeType || MimeType.JPEG, attachment.name || `Attachment_${idNumber}.bin`);
      const folderName = 'مرفقات بنزط أطفال';
      let folder;
      const it = DriveApp.getFoldersByName(folderName);
      folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
      const file = folder.createFile(blob);
      file.setName(`مرفق_${idNumber}_${new Date().getTime()}`);
      fileUrl = file.getUrl();
    }
  } catch (fileErr) {
    Logger.log('Children clothes file upload failed: ' + fileErr);
  }

  const requestId = 'CLOTH' + new Date().getTime();
  sheet.appendRow([
    requestId,
    new Date(),
    idNumber || '',
    fullName || '',
    phone || '',
    address || '',
    Number(childrenCount) || 0,
    sizesDetails || '',
    priority || 'عادي',
    notes || '',
    'جديد',
    fileUrl
  ]);

  return { success: true, message: 'تم استلام طلب بنزط الأطفال وسيتم مراجعته قريباً.' };
}

/**
 * ========================== MARTYRS FUNCTIONS ==========================
 */

/**
 * التحقق من وجود الشهيد في قاعدة البيانات
 * payload: { martyrId }
 */
function handleVerifyMartyrId(martyrId) {
  if (!martyrId || martyrId.length !== 9) {
    return { success: true, exists: false };
  }
  
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INDIVIDUALS_SHEET);
    if (!sheet) return { success: true, exists: false };
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, exists: false };
    
    const headers = data[0];
    const idColIndex = headers.indexOf('رقم الهوية');
    const nameColIndex = headers.indexOf('الاسم الكامل');
    
    if (idColIndex === -1) return { success: true, exists: false };
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]).trim() === String(martyrId).trim()) {
        const martyrName = nameColIndex >= 0 ? data[i][nameColIndex] : '';
        return { success: true, exists: true, martyrName };
      }
    }
    
    return { success: true, exists: false };
  } catch (error) {
    Logger.log('Error verifying martyr ID: ' + error);
    return { success: true, exists: false };
  }
}

/**
 * تسجيل شهيد جديد
 * payload: { martyrID, martyrName, martyrdomDate, martyrdomPlace, martyrdomCause, additionalDetails, fatherID, deathCertificate: { name, mimeType, data(Base64) } }
 */
function handleSubmitMartyrRegistration(payload) {
  const { martyrID, martyrName, martyrdomDate, martyrdomPlace, martyrdomCause, additionalDetails, fatherID, deathCertificate } = payload;
  if (!martyrID || !martyrName || !martyrdomDate || !martyrdomPlace || !martyrdomCause) {
    throw new Error('جميع الحقول مطلوبة: رقم الهوية، اسم الشهيد، تاريخ الاستشهاد، مكان الاستشهاد، سبب الاستشهاد');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(MARTYRS_SHEET) || ss.insertSheet(MARTYRS_SHEET);

  // إنشاء العناوين إن لم تكن موجودة
  const rangeValues = sheet.getDataRange().getValues();
  if (!rangeValues || rangeValues.length === 0) {
    sheet.appendRow([
      'معرف الطلب', 
      'تاريخ التسجيل', 
      'رقم هوية الشهيد', 
      'اسم الشهيد', 
      'تاريخ الاستشهاد', 
      'مكان الاستشهاد', 
      'سبب الاستشهاد', 
      'تفاصيل إضافية', 
      'حالة الطلب', 
      'رابط شهادة الوفاة'
    ]);
  }

  // التحقق من وجود الشهيد في قاعدة البيانات
  const verifyRes = handleVerifyMartyrId(martyrID);
  const martyrExists = verifyRes.exists;
  
  // التحقق من هوية الأب إذا كانت موجودة
  let fatherExists = false;
  let fatherName = '';
  if (fatherID && fatherID.length === 9) {
    const fatherVerifyRes = handleVerifyMartyrId(fatherID); // استخدام نفس الدالة للتحقق
    fatherExists = fatherVerifyRes.exists;
    fatherName = fatherVerifyRes.martyrName || '';
  }

  // رفع شهادة الوفاة إلى جوجل درايف إن وُجدت
  let fileUrl = '';
  try {
    if (deathCertificate && deathCertificate.data) {
      const bytes = Utilities.base64Decode(deathCertificate.data);
      const blob = Utilities.newBlob(bytes, deathCertificate.mimeType || MimeType.JPEG, deathCertificate.name || `DeathCertificate_${martyrID || ''}.bin`);
      // وضع الملف داخل مجلد مخصص
      const folderName = 'شهادات الوفاة - الشهداء';
      let folder;
      const it = DriveApp.getFoldersByName(folderName);
      folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
      const file = folder.createFile(blob);
      file.setName(`شهادة_وفاة_${martyrID || ''}_${new Date().getTime()}`);
      fileUrl = file.getUrl();
    }
  } catch (fileErr) {
    // لا نوقف العملية بسبب فشل الرفع، فقط نسجل بدون رابط
    Logger.log('Death certificate upload failed: ' + fileErr);
  }

  const requestId = 'MARTYR' + new Date().getTime();
  
  // تحديد الحالة بناءً على التحقق
  let status;
  if (martyrExists) {
    status = 'جديد'; // الشهيد موجود في قاعدة البيانات
  } else if (fatherID && fatherExists) {
    status = 'جديد'; // الشهيد غير موجود لكن الأب موجود في العائلة
  } else {
    status = 'قيد المراجعة'; // يحتاج مراجعة إدارية
  }
  
  sheet.appendRow([
    requestId, 
    new Date(), 
    martyrID, 
    martyrName, 
    new Date(martyrdomDate), 
    martyrdomPlace, 
    martyrdomCause, 
    additionalDetails || '', 
    status, 
    fileUrl
  ]);

  // رسالة الإرجاع حسب الحالة
  let message;
  if (martyrExists) {
    message = 'تم تسجيل الشهيد بنجاح. إنا لله وإنا إليه راجعون.';
  } else if (fatherID && fatherExists) {
    message = `تم تسجيل الشهيد بنجاح باستخدام بيانات الأب (${fatherName}). إنا لله وإنا إليه راجعون.`;
  } else {
    message = 'تم إرسال الطلب للمراجعة الإدارية. سيتم التواصل معكم قريباً.';
  }
  
  // إنشاء إشعار للأدمن عن طلب شهيد جديد
  createNotification({
    type: 'new_martyr_request',
    title: 'طلب تسجيل شهيد جديد',
    message: `تم استلام طلب تسجيل شهيد باسم "${martyrName}" - ${martyrID}. إنا لله وإنا إليه راجعون.`,
    priority: 'high',
    isAdmin: true
  });
  
  return { 
    success: true, 
    message: message
  };
}

/**
 * Submit injury registration (public form)
 * payload: { injuredID, fatherID, injuryDate, injuryPlace, injuryCause, additionalDetails, injuryFile: { name, mimeType, data } }
 */
function handleSubmitInjuryRegistration(payload) {
  try {
    const { injuredID, fatherID, injuryDate, injuryPlace, injuryCause, additionalDetails, injuryFile } = payload;
    if (!injuredID || !injuryDate || !injuryPlace || !injuryCause) {
      throw new Error('\u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629: \u0631\u0642\u0645 \u0627\u0644\u0645\u0635\u0627\u0628 \u0648\u0645\u0643\u0627\u0646 \u0627\u0644\u0625\u0635\u0627\u0628\u0629 \u0648\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062d\u0627\u0644\u0629');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(INJURIES_SHEET) || ss.insertSheet(INJURIES_SHEET);

    // ensure headers
    const existing = sheet.getDataRange().getValues();
    if (!existing || existing.length === 0) {
      sheet.appendRow([
        '\u0645\u0639\u0631\u0641 \u0627\u0644\u0637\u0644\u0628',
        '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644',
        '\u0631\u0642\u0645 \u0627\u0644\u0645\u0635\u0627\u0628',
        '\u0631\u0642\u0645 \u0627\u0644\u0623\u0628',
        '\u0645\u0643\u0627\u0646 \u0627\u0644\u0625\u0635\u0627\u0628\u0629',
        '\u0633\u0628\u0628 \u0627\u0644\u0625\u0635\u0627\u0628\u0629',
        '\u062a\u0641\u0627\u0635\u064a\u0644',
        '\u062d\u0627\u0644\u0629',
        '\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0644\u0641'
      ]);
    }

    // upload file to Drive if provided
    let fileUrl = '';
    try {
      if (injuryFile && injuryFile.data) {
        const bytes = Utilities.base64Decode(injuryFile.data);
        const blob = Utilities.newBlob(bytes, injuryFile.mimeType || MimeType.JPEG, injuryFile.name || ('injury_' + injuredID));
        const folderName = '\u0627\u0635\u0627\u0628\u0627\u062a - \u0627\u0644\u0625\u0635\u0627\u0628\u0627\u062a';
        let folderIter = DriveApp.getFoldersByName(folderName);
        let folder = folderIter.hasNext() ? folderIter.next() : DriveApp.createFolder(folderName);
        const file = folder.createFile(blob);
        file.setName(`injury_${injuredID}_${new Date().getTime()}`);
        fileUrl = file.getUrl();
      }
    } catch (fileErr) {
      Logger.log('Injury file upload failed: ' + fileErr);
    }

    const requestId = 'INJ' + new Date().getTime();
    const status = '\u062c\u062f\u064a\u062f';
    sheet.appendRow([
      requestId,
      new Date(),
      injuredID,
      fatherID || '',
      new Date(injuryDate),
      injuryPlace || '',
      injuryCause || '',
      additionalDetails || '',
      status,
      fileUrl
    ]);

    // إنشاء إشعار للأدمن عن إصابة جديدة
    createNotification({
      type: 'new_injury_request',
      title: 'تسجيل إصابة جديدة',
      message: `تم تسجيل إصابة جديدة للمصاب رقم ${injuredID} في ${injuryPlace}. السبب: ${injuryCause}`,
      priority: 'high',
      isAdmin: true
    });

    return { success: true, message: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0625\u0635\u0627\u0628\u0629 \u0628\u0646\u062c\u0627\u062d' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Return injury requests for admin pages
 */
function handleGetInjuryRequests(token) {
  authenticateToken(token);
  const rows = sheetToJSON(INJURIES_SHEET);
  const sorted = rows.sort((a, b) => new Date(b['\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644']) - new Date(a['\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644']));
  return { success: true, data: sorted };
}

/**
 * Update injury request status (admin)
 * payload: { token, requestId, newStatus }
 */
function handleUpdateInjuryRequestStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error('\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u0643\u062a\u0645\u0644\u0629 \u0644\u062a\u062d\u062f\u064a\u062b \u062d\u0627\u0644\u0629');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INJURIES_SHEET);
  if (!sheet) throw new Error('\u0648\u0631\u0642\u0629 \u0627\u0635\u0627\u0628\u0627\u062a \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a');
  const headers = data[0];
  const idCol = headers.indexOf('\u0645\u0639\u0631\u0641 \u0627\u0644\u0637\u0644\u0628');
  const statusCol = headers.indexOf('\u062d\u0627\u0644\u0629');
  if (idCol === -1 || statusCol === -1) throw new Error('\u0623\u0639\u0645\u062f\u0629 \u0627\u0644\u0637\u0644\u0628 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(requestId).trim()) {
      const injuredIdCol = headers.indexOf('رقم المصاب');
      const injuryPlaceCol = headers.indexOf('مكان الإصابة');
      const injuredId = data[i][injuredIdCol];
      const injuryPlace = data[i][injuryPlaceCol];
      
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      logAdminAction(admin.username, 'تحديث حالة الإصابة', `تم تحديث ${requestId} إلى ${newStatus}`);
      
      // إنشاء إشعار للمستخدم عن تحديث حالة الإصابة
      let notificationMessage = '';
      let notificationType = '';
      
      if (newStatus === 'مقبول') {
        notificationMessage = `تم قبول تسجيل الإصابة في ${injuryPlace}. تم إضافتها إلى النظام.`;
        notificationType = 'injury_request_approved';
      } else if (newStatus === 'مرفوض') {
        notificationMessage = `تم رفض تسجيل الإصابة في ${injuryPlace}. يرجى مراجعة الإدارة للمزيد من التفاصيل.`;
        notificationType = 'injury_request_rejected';
      } else {
        notificationMessage = `تم تحديث حالة تسجيل الإصابة في ${injuryPlace} إلى: ${newStatus}`;
        notificationType = 'injury_request_updated';
      }
      
      createNotification({
        userId: injuredId,
        type: notificationType,
        title: 'تحديث حالة الإصابة',
        message: notificationMessage,
        priority: 'normal'
      });
      
      return { success: true, message: 'تم تحديث الحالة' };
    }
  }
  throw new Error('\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628');
}

/**
 * إرجاع طلبات الشهداء للإدارة
 */
function handleGetMartyrRequests(token) {
  try {
    authenticateToken(token);
    Logger.log('Getting martyr requests for sheet: ' + MARTYRS_SHEET);
    
    // التحقق من وجود الشيت وإنشاؤه إذا لم يكن موجود
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(MARTYRS_SHEET);
    
    if (!sheet) {
      Logger.log('Martyrs sheet not found, creating new sheet: ' + MARTYRS_SHEET);
      // إنشاء الشيت إذا لم يكن موجود
      sheet = ss.insertSheet(MARTYRS_SHEET);
      sheet.appendRow([
        'معرف الطلب', 
        'تاريخ التسجيل', 
        'رقم هوية الشهيد', 
        'اسم الشهيد', 
        'تاريخ الاستشهاد', 
        'مكان الاستشهاد', 
        'سبب الاستشهاد', 
        'تفاصيل إضافية', 
        'حالة الطلب', 
        'رابط شهادة الوفاة'
      ]);
      Logger.log('New martyrs sheet created successfully');
      return { success: true, data: [] };
    }
    
    Logger.log('Martyrs sheet found, getting data...');
    const rows = sheetToJSON(MARTYRS_SHEET);
    Logger.log('Found ' + rows.length + ' martyr records');
    
    // ترتيب تنازلي حسب التاريخ
    const sorted = rows.sort((a, b) => new Date(b['تاريخ التسجيل']) - new Date(a['تاريخ التسجيل']));
    return { success: true, data: sorted };
    
  } catch (error) {
    Logger.log('Error in handleGetMartyrRequests: ' + error.toString());
    return { success: false, message: 'خطأ في جلب بيانات الشهداء: ' + error.message };
  }
}

/**
 * Return special-case requests for admin pages
 */
function handleGetSpecialCaseRequests(token) {
  try {
    authenticateToken(token);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SPECIAL_CASES_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(SPECIAL_CASES_SHEET);
      sheet.appendRow(['معرف الطلب','تاريخ الإرسال','رقم مقدم الطلب','اسم مقدم الطلب','هوية الزوج/الزوجة','هوية رب الأسرة (للتحقق)','نوع الحالة','وصف الحالة','تاريخ الحالة','رابط المرفق','حالة']);
      return { success: true, data: [] };
    }
    const rows = sheetToJSON(SPECIAL_CASES_SHEET);
    const sorted = rows.sort((a,b) => new Date(b['تاريخ الإرسال']) - new Date(a['تاريخ الإرسال']));
    return { success: true, data: sorted };
  } catch (err) {
    Logger.log('Error in handleGetSpecialCaseRequests: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Update special case status (admin)
 * payload: { token, requestId, newStatus }
 */
function handleUpdateSpecialCaseStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error('بيانات غير مكتملة لتحديث حالة الطلب.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SPECIAL_CASES_SHEET);
  if (!sheet) throw new Error('ورقة حالات خاصة غير موجودة.');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('لا توجد طلبات.');
  const headers = data[0];
  const idCol = headers.indexOf('معرف الطلب');
  const statusCol = headers.indexOf('حالة');
  if (idCol === -1 || statusCol === -1) throw new Error('أعمدة الطلب غير صحيحة.');

  for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === String(requestId).trim()) {
      // update status
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      // update updater columns if present
      const notesCol = headers.indexOf('ملاحظات الإدارة');
      const updaterCol = headers.indexOf('آخر تحديث بواسطة');
      const updateDateCol = headers.indexOf('تاريخ آخر تحديث');
      if (typeof payload.adminNotes !== 'undefined' && notesCol !== -1) sheet.getRange(i + 1, notesCol + 1).setValue(payload.adminNotes || '');
      if (updaterCol !== -1) sheet.getRange(i + 1, updaterCol + 1).setValue(admin.username || '');
      if (updateDateCol !== -1) sheet.getRange(i + 1, updateDateCol + 1).setValue(new Date());
      
      // Send notification to user about status update
      const userIdCol = headers.indexOf('رقم مقدم الطلب');
      if (userIdCol !== -1) {
        const userId = data[i][userIdCol];
        let notificationMessage = '';
        if (newStatus === 'معتمد') {
          notificationMessage = `تم قبول طلب الحالة الخاصة رقم ${requestId}`;
        } else if (newStatus === 'مرفوض') {
          notificationMessage = `تم رفض طلب الحالة الخاصة رقم ${requestId}`;
        } else {
          notificationMessage = `تم تحديث حالة طلب الحالة الخاصة رقم ${requestId} إلى: ${newStatus}`;
        }
        
        createNotification(
          userId,
          'تحديث حالة طلب الحالة الخاصة',
          notificationMessage,
          'مهم'
        );
      }
      
      logAdminAction(admin.username, 'تحديث حالة حالات خاصة', `تم تحديث ${requestId} إلى ${newStatus}`);
      return { success: true, message: 'تم تحديث حالة الطلب.' };
    }
  }
  throw new Error('لم يتم العثور على الطلب المطلوب.');
}

/**
 * تحديث حالة طلب شهيد
 * payload: { token, requestId, newStatus }
 */
function handleUpdateMartyrRequestStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error('بيانات غير مكتملة لتحديث حالة الطلب.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MARTYRS_SHEET);
  if (!sheet) throw new Error('ورقة "الشهداء" غير موجودة.');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('لا توجد طلبات.');
  const headers = data[0];
  const idCol = headers.indexOf('معرف الطلب');
  const statusCol = headers.indexOf('حالة الطلب');
  if (idCol === -1 || statusCol === -1) throw new Error('أعمدة الطلب غير صحيحة.');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(requestId).trim()) {
      const martyrIdCol = headers.indexOf('رقم هوية الشهيد');
      const martyrNameCol = headers.indexOf('اسم الشهيد');
      const martyrId = data[i][martyrIdCol];
      const martyrName = data[i][martyrNameCol];
      
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      logAdminAction(admin.username, 'تحديث حالة طلب شهيد', `تم تحديث ${requestId} إلى ${newStatus}`);
      
      // إنشاء إشعار للمستخدم عن تحديث حالة طلب الشهيد
      let notificationMessage = '';
      let notificationType = '';
      
      if (newStatus === 'مقبول') {
        notificationMessage = `تم قبول طلب تسجيل الشهيد "${martyrName}". تم إضافته إلى سجل الشهداء. إنا لله وإنا إليه راجعون.`;
        notificationType = 'martyr_request_approved';
      } else if (newStatus === 'مرفوض') {
        notificationMessage = `تم رفض طلب تسجيل الشهيد "${martyrName}". يرجى مراجعة الإدارة للمزيد من التفاصيل.`;
        notificationType = 'martyr_request_rejected';
      } else {
        notificationMessage = `تم تحديث حالة طلب تسجيل الشهيد "${martyrName}" إلى: ${newStatus}`;
        notificationType = 'martyr_request_updated';
      }
      
      // إرسال الإشعار لمقدم الطلب (قد يكون الأب أو قريب)
      createNotification({
        userId: martyrId,
        type: notificationType,
        title: 'تحديث حالة طلب الشهيد',
        message: notificationMessage,
        priority: 'normal'
      });
      
      return { success: true, message: 'تم تحديث حالة الطلب.' };
    }
  }
  throw new Error('لم يتم العثور على الطلب المطلوب.');
}

/**
 * إرجاع طلبات الوفيات للإدارة
 */
function handleGetDeathRequests(token) {
  try {
    authenticateToken(token);
    Logger.log('Getting death requests for sheet: ' + DEATHS_SHEET);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DEATHS_SHEET);
    if (!sheet) {
      Logger.log('Deaths sheet not found, creating new sheet: ' + DEATHS_SHEET);
      sheet = ss.insertSheet(DEATHS_SHEET);
      sheet.appendRow([
        'معرف الطلب',
        'تاريخ التسجيل',
        'رقم هوية المتوفى',
        'اسم المتوفى',
        'تاريخ الوفاة',
        'مكان الوفاة',
        'سبب الوفاة',
        'تفاصيل إضافية',
        'حالة الطلب',
        'رابط شهادة الوفاة'
      ]);
      return { success: true, data: [] };
    }

    const rows = sheetToJSON(DEATHS_SHEET);
    const sorted = rows.sort((a, b) => new Date(b['تاريخ التسجيل']) - new Date(a['تاريخ التسجيل']));
    return { success: true, data: sorted };
  } catch (error) {
    Logger.log('Error in handleGetDeathRequests: ' + error.toString());
    return { success: false, message: 'خطأ في جلب بيانات الوفيات: ' + error.message };
  }
}

/**
 * تحديث حالة طلب وفاة
 * payload: { token, requestId, newStatus }
 */
function handleUpdateDeathRequestStatus(payload) {
  const admin = authenticateToken(payload.token);
  const { requestId, newStatus } = payload;
  if (!requestId || !newStatus) throw new Error('بيانات غير مكتملة لتحديث حالة الطلب.');

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DEATHS_SHEET);
  if (!sheet) throw new Error('ورقة "الوفيات" غير موجودة.');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('لا توجد طلبات.');
  const headers = data[0];
  const idCol = headers.indexOf('معرف الطلب');
  const statusCol = headers.indexOf('حالة الطلب');
  if (idCol === -1 || statusCol === -1) throw new Error('أعمدة الطلب غير صحيحة.');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(requestId).trim()) {
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      
      // Send notification to user about status update
      const userIdCol = headers.indexOf('رقم هوية المتوفى');
      if (userIdCol !== -1) {
        const userId = data[i][userIdCol];
        let notificationMessage = '';
        if (newStatus === 'معتمد') {
          notificationMessage = `تم قبول طلب تسجيل الوفاة رقم ${requestId}`;
        } else if (newStatus === 'مرفوض') {
          notificationMessage = `تم رفض طلب تسجيل الوفاة رقم ${requestId}`;
        } else {
          notificationMessage = `تم تحديث حالة طلب تسجيل الوفاة رقم ${requestId} إلى: ${newStatus}`;
        }
        
        createNotification(
          userId,
          'تحديث حالة طلب تسجيل الوفاة',
          notificationMessage,
          'مهم'
        );
      }
      
      logAdminAction(admin.username, 'تحديث حالة طلب وفاة', `تم تحديث ${requestId} إلى ${newStatus}`);
      return { success: true, message: 'تم تحديث حالة الطلب.' };
    }
  }
  throw new Error('لم يتم العثور على الطلب المطلوب.');
}

/**
 * تسجيل وفاة جديدة
 * payload: { deceasedID, deceasedName, deathDate, deathPlace, deathCause, additionalDetails, fatherID, deathCertificate }
 */
function handleSubmitDeathRegistration(payload) {
  const { deceasedID, deceasedName, deathDate, deathPlace, deathCause, additionalDetails, fatherID, deathCertificate } = payload;
  if (!deceasedID || !deceasedName || !deathDate || !deathPlace || !deathCause) {
    throw new Error('جميع الحقول مطلوبة: رقم الهوية، اسم المتوفى، تاريخ الوفاة، مكان الوفاة، سبب الوفاة');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DEATHS_SHEET) || ss.insertSheet(DEATHS_SHEET);

  // Ensure headers exist
  const rangeValues = sheet.getDataRange().getValues();
  if (!rangeValues || rangeValues.length === 0) {
    sheet.appendRow([
      'معرف الطلب',
      'تاريخ التسجيل',
      'رقم هوية المتوفى',
      'اسم المتوفى',
      'تاريخ الوفاة',
      'مكان الوفاة',
      'سبب الوفاة',
      'تفاصيل إضافية',
      'حالة الطلب',
      'رابط شهادة الوفاة'
    ]);
  }

  // Verify existence in family DB
  let deceasedExists = false;
  try {
    const v = handleGetUserData && typeof handleGetUserData === 'function' ? handleGetUserData(deceasedID) : null;
    if (v && v.success && v.data) deceasedExists = true;
  } catch (e) {
    deceasedExists = false;
  }

  // Check father identity if provided
  let fatherExists = false;
  let fatherName = '';
  if (fatherID && fatherID.length === 9) {
    try {
      const fv = handleGetUserData(fatherID);
      if (fv && fv.success && fv.data) {
        fatherExists = true;
        fatherName = fv.data['الاسم الكامل'] || '';
      }
    } catch (e) {
      fatherExists = false;
    }
  }

  // Upload death certificate if present
  let fileUrl = '';
  try {
    if (deathCertificate && deathCertificate.data) {
      const bytes = Utilities.base64Decode(deathCertificate.data);
      const blob = Utilities.newBlob(bytes, deathCertificate.mimeType || MimeType.JPEG, deathCertificate.name || `DeathCertificate_${deceasedID || ''}.bin`);
      const folderName = 'شهادات الوفاة - الوفيات';
      let folder;
      const it = DriveApp.getFoldersByName(folderName);
      folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);
      const file = folder.createFile(blob);
      file.setName(`شهادة_وفاة_${deceasedID || ''}_${new Date().getTime()}`);
      fileUrl = file.getUrl();
    }
  } catch (fileErr) {
    Logger.log('Death certificate upload failed: ' + fileErr);
  }

  const requestId = 'DEATH' + new Date().getTime();
  let status;
  if (deceasedExists) {
    status = 'جديد';
  } else if (fatherID && fatherExists) {
    status = 'جديد';
  } else {
    status = 'قيد المراجعة';
  }

  sheet.appendRow([
    requestId,
    new Date(),
    deceasedID,
    deceasedName,
    new Date(deathDate),
    deathPlace,
    deathCause,
    additionalDetails || '',
    status,
    fileUrl
  ]);

  let message;
  if (deceasedExists) {
    message = 'تم تسجيل الوفاة بنجاح.';
  } else if (fatherID && fatherExists) {
    message = `تم تسجيل الوفاة بنجاح باستخدام بيانات الأب (${fatherName}).`;
  } else {
    message = 'تم إرسال الطلب للمراجعة الإدارية. سيتم التواصل معكم قريباً.';
  }

  // إنشاء إشعار للأدمن عن طلب وفاة جديد
  createNotification({
    type: 'new_death_request',
    title: 'تسجيل وفاة جديدة',
    message: `تم تسجيل وفاة جديدة للمتوفى "${deceasedName}" - ${deceasedID}. إنا لله وإنا إليه راجعون.`,
    priority: 'high',
    isAdmin: true
  });

  return { success: true, message };
}

/**
 * =================================================================
 * MEMBERS MANAGEMENT FUNCTIONS
 * =================================================================
 */

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