# WashAlert UAT / QA Test Execution Sheet
Project: WashAlert System  
Version/Build: ____________________  
Environment: ____________________  
Test Date: ____________________  
Tester Name: ____________________  

## Instructions
1. Execute each test case in order.
2. Record the actual behavior under `Actual Result`.
3. Mark `Pass/Fail` as `PASS` or `FAIL`.
4. Add notes in `Remarks` for any issue.

## Authentication and OTP
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| AUTH-001 | Open app -> Sign Up -> fill valid form -> Create Account -> enter correct OTP -> Verify OTP | Account created, OTP accepted, redirected to Login |  |  |  |
| AUTH-002 | Verify page -> enter valid email + wrong OTP -> Verify OTP | Error shown, verification blocked |  |  |  |
| AUTH-003 | Verify page -> click Resend OTP -> enter new OTP -> Verify | New OTP accepted and verification succeeds |  |  |  |
| AUTH-004 | Login as Admin with valid credentials | Dashboard loads successfully |  |  |  |
| AUTH-005 | Login with valid email + wrong password | Login blocked with error message |  |  |  |
| AUTH-006 | Forgot Password -> send reset link -> reset with valid token/new password -> login | Password reset succeeds; new password works |  |  |  |
| AUTH-007 | Reset Password page -> invalid/expired token + valid password | Reset blocked with error |  |  |  |

## Role-Based Access (Admin vs Staff)
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| RBAC-001 | Login as Admin -> review sidebar modules | Admin sees full modules (including Users, Machines) |  |  |  |
| RBAC-002 | Login as Staff -> review sidebar modules | Staff cannot see restricted modules |  |  |  |
| RBAC-003 | Login as Staff -> manually open `/users` and `/machines` | Access denied / redirected to unauthorized page |  |  |  |

## User Management (Admin)
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| USER-001 | Open User Management -> Create User -> submit valid data | New user appears in table |  |  |  |
| USER-002 | Create User using duplicate email | Request rejected with duplicate email error |  |  |  |
| USER-003 | Edit existing user details -> Save | User details updated and persisted |  |  |  |
| USER-004 | Deactivate user then activate user | Status toggles correctly and persists |  |  |  |

## Order Management
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| ORDER-001 | Create Order with valid fields | Order appears under Pending |  |  |  |
| ORDER-002 | Open order card -> Details -> Edit -> Save | Updated details are reflected in UI/backend |  |  |  |
| ORDER-003 | Drag order card to another status column | Status updates immediately and persists on refresh |  |  |  |
| ORDER-004 | Open order -> Delete -> Confirm | Order removed and no longer visible after refresh |  |  |  |
| ORDER-005 | Try creating order with required fields blank | Validation blocks submission |  |  |  |

## Delivery Management
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| DEL-001 | Create Delivery with valid tracking/rider details | Delivery record created and listed |  |  |  |
| DEL-002 | Assign/Reassign rider on existing delivery | Rider assignment updates and persists |  |  |  |
| DEL-003 | Change delivery status -> Update Status | Status updates and persists on refresh |  |  |  |
| DEL-004 | Create delivery with invalid/non-existing tracking | Request rejected with error |  |  |  |

## Inventory
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| INV-001 | Create inventory item with valid values | Item is created and shown in list |  |  |  |
| INV-002 | Edit inventory item details -> Save | Item updates and persists |  |  |  |
| INV-003 | Adjust stock IN/OUT with reason | Stock changes correctly |  |  |  |
| INV-004 | Adjust OUT beyond available stock | Operation blocked with validation error |  |  |  |
| INV-005 | Delete inventory item -> Confirm | Item removed from list |  |  |  |

## AI Analytics
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| ANL-001 | Set from/to/branch filters -> Apply Filters | Charts and cards update with filtered data |  |  |  |
| ANL-002 | Set invalid date range (To earlier than From) -> Apply | Validation error shown; filter not applied |  |  |  |
| ANL-003 | Click Export CSV | CSV downloads with analytics data |  |  |  |

## AI Chat Support
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| CHAT-001 | Send general support question | AI response displayed and saved in history |  |  |  |
| CHAT-002 | Send valid tracking query then invalid tracking query | Valid returns data; invalid returns friendly not-found |  |  |  |
| CHAT-003 | Send complaint/escalation message | Escalation ticket created and displayed |  |  |  |
| CHAT-004 | Send messages -> refresh page -> reopen chat | Conversation and ticket history persist |  |  |  |

## Notifications
| Test Case ID | Steps | Expected Result | Actual Result | Pass/Fail | Remarks |
|---|---|---|---|---|---|
| NTF-001 | Click bell icon | Notification dropdown loads backend data |  |  |  |
| NTF-002 | Click a notification item | User is routed to target module/page |  |  |  |
| NTF-003 | Click Mark all read | Unread count resets and items marked read |  |  |  |

## Defect Log Summary
| Defect ID | Linked Test Case ID | Severity (Low/Med/High/Critical) | Description | Status (Open/Closed) |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## UAT Sign-Off
Business Representative: ____________________  
Signature: ____________________  
Date: ____________________  

QA Lead: ____________________  
Signature: ____________________  
Date: ____________________  

Project Lead: ____________________  
Signature: ____________________  
Date: ____________________  

Final UAT Decision: `APPROVED / NOT APPROVED`

