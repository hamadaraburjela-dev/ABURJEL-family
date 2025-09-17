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
  return { success: true, message: 'تمت إضافة المساعدة بنجاح!' };
}

function handleBulkAddAidFromXLSX(payload) {
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
  return { success: true, message: 'تم إرسال طلب إعادة تعيين كلمة المرور. سيقوم المسؤول بالتعامل معه قريباً.' };
}

function handleGetResetRequests(token) {
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
                    break;
                }
            }
        }
    }

    return { success: true, message: 'تم محو كلمة المرور بنجاح. يمكن للفرد الآن تعيين كلمة مرور جديدة.' };
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
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift().map(header => header.trim());
  return values.map(row =>
    headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {})
  );
}

function authenticateToken(token, requiredRole = null) {
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