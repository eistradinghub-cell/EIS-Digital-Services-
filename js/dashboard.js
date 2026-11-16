<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#1246a0">
    <meta name="description" content="EIS Digital Services Customer Dashboard">
    <title>Dashboard | EIS Digital Services</title>
    <link rel="stylesheet" href="css/styles.css?v=18"><style>
*{box-sizing:border-box}
body.dashboard-page{margin:0;background:#fff;color:#172b4d;font-family:Arial,Helvetica,sans-serif}
.dashboard-page .site-header{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e4ebf5;box-shadow:0 2px 12px rgba(18,70,160,.05)}
.dashboard-page .nav-row{max-width:1200px;min-height:68px;margin:auto;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.dashboard-page .brand{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none}
.dashboard-page .brand-mark{width:42px;height:42px}
.dashboard-page .brand-text{display:flex;flex-direction:column}
.dashboard-page .brand-text b{color:#1246a0;font-size:21px;line-height:1.2}
.dashboard-page .brand-text span{color:#52709c;font-size:12px}
.dashboard-page .nav-right{display:flex;align-items:center;justify-content:flex-end;gap:15px;flex:1}
.dashboard-page .nav-links{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.dashboard-page .nav-links .btn{padding:10px 14px;border:1px solid #dce6f5;border-radius:7px;background:#fff;color:#17458f;font-size:13px;text-decoration:none;cursor:pointer}
.dashboard-page .nav-links .btn.active{background:#1246a0;border-color:#1246a0;color:#fff}
.dashboard-page .nav-links #nav-logout{color:#b42335;border-color:#f0d5da}
.dashboard-page .notification-area{position:relative;flex-shrink:0}
.dashboard-page .notification-button{position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border:1px solid #dce6f5;border-radius:8px;background:#fff;color:#1246a0;cursor:pointer}
.dashboard-page .notification-button:hover{background:#f0f5ff}
.dashboard-page .notification-count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;display:none;align-items:center;justify-content:center;border-radius:20px;background:#e33145;color:#fff;border:2px solid #fff;font-size:10px;font-weight:bold}
.dashboard-page .notification-dropdown{position:absolute;top:50px;right:0;z-index:1000;width:min(350px,88vw);max-height:390px;overflow-y:auto;padding:16px;display:none;border:1px solid #e0e9f7;border-radius:10px;background:#fff;box-shadow:0 12px 30px rgba(18,70,160,.14)}
.dashboard-page .notification-dropdown.open{display:block}
.dashboard-page .notification-item{padding:12px 0;border-bottom:1px solid #edf1f8}
.dashboard-page .notification-item:last-child{border-bottom:0}
.dashboard-page .notification-item strong{display:block;margin-bottom:5px;color:#1246a0;font-size:13px}
.dashboard-page .notification-item p{color:#536b8d;font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.dashboard-page .notification-item time{display:block;margin-top:6px;color:#8495ad;font-size:10px}
.dashboard-page .dashboard-main{max-width:1200px;margin:auto;padding:28px 20px}
.dashboard-page .dashboard-intro{margin-bottom:22px;padding:26px 27px;background:#1246a0;border:1px solid #1246a0;border-radius:12px}
.dashboard-page .dashboard-intro h1{margin:0 0 9px;color:#fff;font-size:clamp(23px,4vw,30px);font-weight:700;line-height:1.35}
.dashboard-page .dashboard-intro p{max-width:680px;margin:0;color:#e4edff;font-size:14px;line-height:1.7}
.dashboard-page .dashboard-card{margin-bottom:22px;padding:23px;background:#fff;border:1px solid #e0e9f7;border-radius:11px;box-shadow:0 4px 16px rgba(18,70,160,.045)}
.dashboard-page .section-heading{margin:0 0 8px;color:#1246a0;font-size:20px;font-weight:700}
.dashboard-page .section-description{margin:0 0 18px;color:#627795;font-size:13px;line-height:1.7}
.dashboard-page .svcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:13px;margin-top:15px}
.dashboard-page .service-card{display:flex;flex-direction:column;min-width:0;padding:15px;background:#fff;border:1px solid #dce7f8;border-top:3px solid #2463c5;border-radius:9px;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.dashboard-page .service-card:hover{transform:translateY(-2px);border-color:#8eb2ed;box-shadow:0 7px 18px rgba(18,70,160,.09)}
.dashboard-page .service-card h3{margin:3px 0 9px;color:#153f83;font-size:15px;line-height:1.45;overflow-wrap:anywhere}
.dashboard-page .service-card p{margin:0 0 10px;color:#1456b8;font-size:17px;font-weight:700}
.dashboard-page .service-card .service-description{margin-bottom:13px;color:#627795;font-size:12px;line-height:1.6}
.dashboard-page .service-card button{width:100%;margin-top:auto;padding:10px 12px;border:1px solid #1456b8;border-radius:7px;background:#1456b8;color:#fff;font-weight:600;cursor:pointer}
.dashboard-page .service-card button:hover{background:#0d3987}
.dashboard-page .btn-primary{border:1px solid #1456b8;border-radius:7px;background:#1456b8;color:#fff;cursor:pointer}
.dashboard-page .btn-primary:hover{background:#0d3987}
.dashboard-page #pay-section{margin-top:22px;padding:20px;border:1px solid #cbdcf7;border-radius:10px;background:#f5f8ff}
.dashboard-page #pay-section h3{margin:0 0 10px;color:#1246a0;font-size:18px}
.dashboard-page .demo{padding:13px;margin:14px 0;border:1px solid #e9d79e;border-radius:7px;background:#fffaf0;color:#765d24;font-size:13px;line-height:1.7}
.dashboard-page #btn-pay{min-height:44px;font-weight:700}
.dashboard-page #app-form{margin-top:22px}
.dashboard-page .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.dashboard-page .form-grid>div{min-width:0}
.dashboard-page .form-grid .full{grid-column:1/-1}
.dashboard-page .form-grid label{display:block;margin-bottom:7px;color:#294b7d;font-size:13px;font-weight:600}
.dashboard-page .form-grid input,.dashboard-page .form-grid select,.dashboard-page .form-grid textarea{width:100%;min-height:43px;padding:10px 11px;border:1px solid #ccd9ed;border-radius:7px;background:#fff;color:#172b4d;font:inherit;font-size:14px}
.dashboard-page .form-grid input:focus,.dashboard-page .form-grid select:focus,.dashboard-page .form-grid textarea:focus{outline:2px solid #d5e4ff;border-color:#2463c5}
.dashboard-page .privacy-note{margin:18px 0;padding:14px;border:1px solid #cbdcf7;border-radius:7px;background:#f3f7ff;color:#345b91;font-size:12px;line-height:1.8}
.dashboard-page .msg{display:none;margin-top:13px;font-size:13px}
.dashboard-page .msg.ok{color:#247448}
.dashboard-page .msg.err{color:#b83232}
.dashboard-page .msg.info{color:#1456b8}
.dashboard-page .table-wrapper{width:100%;overflow-x:auto;margin-top:18px;border:1px solid #e0e9f7;border-radius:8px}
.dashboard-page .applications-table{width:100%;min-width:650px;border-collapse:collapse}
.dashboard-page .applications-table th{padding:13px 12px;background:#edf3ff;color:#244b86;text-align:left;font-size:12px;font-weight:700;white-space:nowrap}
.dashboard-page .applications-table td{padding:14px 12px;border-bottom:1px solid #edf1f8;color:#425979;font-size:13px}
.dashboard-page .status-badge{display:inline-block;padding:5px 9px;border-radius:20px;background:#fff4df;color:#946817;font-size:11px;font-weight:700;white-space:nowrap}
.dashboard-page .status-badge.completed,.dashboard-page .status-badge.approved,.dashboard-page .status-badge.resolved{background:#e9f5ed;color:#287044}
.dashboard-page .status-badge.rejected,.dashboard-page .status-badge.cancelled{background:#faeeee;color:#a83232}
.dashboard-page .status-badge.processing,.dashboard-page .status-badge.in_review{background:#eaf2ff;color:#2458a5}
.dashboard-page .customer-care-banner{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px;padding:23px;background:#edf4ff;border:1px solid #d5e4fb;border-radius:10px}
.dashboard-page .customer-care-banner h2{margin:0 0 8px;color:#1246a0;font-size:20px}
.dashboard-page .customer-care-banner p{margin:0;color:#526b8e;font-size:13px;line-height:1.7}
.dashboard-page .customer-care-banner a{flex-shrink:0;padding:11px 18px;border:1px solid #1456b8;border-radius:7px;background:#1456b8;color:#fff;font-size:13px;text-decoration:none}
.dashboard-page .site-footer{padding:22px 15px;border-top:1px solid #e0e9f7;background:#fff;color:#7185a3;text-align:center;font-size:12px}
@media(max-width:700px){
.dashboard-page .nav-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding:10px 13px}
.dashboard-page .brand-mark{width:38px;height:38px}
.dashboard-page .brand-text b{font-size:19px}
.dashboard-page .nav-right{display:contents}
.dashboard-page .notification-area{order:0;margin-left:auto}
.dashboard-page .nav-links{order:3;width:100%;display:flex;flex-wrap:nowrap;gap:5px;margin-top:7px}
.dashboard-page .nav-links .btn{flex:1 1 0;min-width:0;padding:10px 4px;text-align:center;font-size:11px;white-space:nowrap}
.dashboard-page .dashboard-main{padding:18px 12px}
.dashboard-page .dashboard-intro{padding:21px 17px}
.dashboard-page .dashboard-card{padding:18px 14px}
.dashboard-page .svcs{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dashboard-page .service-card{padding:12px}
.dashboard-page .service-card h3{font-size:14px}
.dashboard-page .service-card p{font-size:15px}
.dashboard-page .service-card .service-description{font-size:11px}
.dashboard-page .service-card button{padding:9px 5px;font-size:12px}
.dashboard-page .form-grid{grid-template-columns:1fr}
.dashboard-page .form-grid .full{grid-column:auto}
.dashboard-page .customer-care-banner{align-items:flex-start;flex-direction:column;padding:19px}
.dashboard-page .customer-care-banner a{width:100%;text-align:center}
}
@media(max-width:370px){
.dashboard-page .svcs{grid-template-columns:1fr}
.dashboard-page .nav-links .btn{padding:9px 2px;font-size:10px}
.dashboard-page .brand-text b{font-size:17px}
}
</style></head><body class="dashboard-page">
<header class="site-header">
    <div class="nav-row">
        <a class="brand" href="dashboard.html">
            <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
                <rect x="2" y="2" width="44" height="44" rx="9" fill="#1246a0"/>
                <path d="M14 32 L24 14 L34 32" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="24" cy="26" r="2.6" fill="#d8eaff"/>
            </svg>
            <span class="brand-text">
                <b>EIS</b>
                <span>Digital Services</span>
            </span>
        </a>    <div class="nav-right">
        <nav class="nav-links">
            <a href="dashboard.html" class="btn active">Dashboard</a>
            <a href="marketplace.html" class="btn">Marketplace</a>
            <a href="admin.html" id="nav-admin" class="btn" style="display:none;">Admin</a>
            <button id="nav-logout" type="button" class="btn">Log out</button>
        </nav>

        <div class="notification-area">
            <button type="button" class="notification-button" id="notification-button" aria-label="Notifications" aria-expanded="false">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>
                    <path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>
                </svg>
                <span id="notification-count" class="notification-count">0</span>
            </button>

            <div id="notification-dropdown" class="notification-dropdown">
                <h3 style="font-size:15px;margin:0 0 8px;color:#1246a0;">Notifications</h3>
                <div id="notifications-list">Loading notifications...</div>
            </div>
        </div>
    </div>
</div>

</header><main class="dashboard-main">
    <section class="dashboard-intro">
        <h1 id="welcome">Welcome to EIS Digital Services</h1>
        <p>Manage your services, follow your applications and stay updated with important notifications from your dashboard.</p>
    </section><section class="card dashboard-card">
    <h2 class="section-heading">Our Services</h2>
    <p class="section-description">Choose a service to view its details, review the information and continue.</p>

    <div id="services-container" class="svcs">
        <p>Loading services...</p>
    </div>

    <div id="pay-section" style="display:none;">
        <h3>Continue to Application</h3>
        <div class="demo">
            <strong>DEMO MODE:</strong>
            This is a payment-flow demonstration only. No money will be charged, transferred or received.
            A demo reference ID is not proof of payment.
        </div>
        <button id="btn-pay" type="button" class="btn btn-primary" style="width:100%;padding:12px;">
            Continue
        </button>
    </div>

    <p id="pay-msg" class="msg"></p>
</section>

<form class="card dashboard-card" id="app-form" style="display:none;">
    <h2 class="section-heading">Application Form</h2>
    <p class="section-description">Complete the required information below.</p>

    <div class="form-grid">

        <div>
            <label for="f-kegow">KEGOW ACC NUMBER *</label>
            <input type="text" id="f-kegow" name="kegowAccount" required>
        </div>

        <div>
            <label for="f-agentState">AGENT LOCATION STATE *</label>
            <select id="f-agentState" name="agentLocationState" required>
                <option value="">Select State</option>
            </select>
        </div>

        <div>
            <label for="f-bvn">BVN NO *</label>
            <input type="text" id="f-bvn" name="bvn" inputmode="numeric" maxlength="11" required>
        </div>

        <div>
            <label for="f-bankName">BANK NAME *</label>
            <input type="text" id="f-bankName" name="bankName" required>
        </div>

        <div>
            <label for="f-accountNo">ACCOUNT NO *</label>
            <input type="text" id="f-accountNo" name="accountNumber" inputmode="numeric" maxlength="10" required>
        </div>

        <div>
            <label for="f-accountName">ACCOUNT NAME *</label>
            <input type="text" id="f-accountName" name="accountName" required>
        </div>

        <div>
            <label for="f-firstName">AGENT FIRST NAME *</label>
            <input type="text" id="f-firstName" name="firstName" autocomplete="given-name" required>
        </div>

        <div>
            <label for="f-middleName">MIDDLE NAME</label>
            <input type="text" id="f-middleName" name="middleName" autocomplete="additional-name">
        </div>

        <div>
            <label for="f-lastName">LAST NAME *</label>
            <input type="text" id="f-lastName" name="lastName" autocomplete="family-name" required>
        </div>

        <div>
            <label for="f-email">EMAIL *</label>
            <input type="email" id="f-email" name="email" autocomplete="email" required>
        </div>

        <div>
            <label for="f-phone">PHONE NO. *</label>
            <input type="tel" id="f-phone" name="phone" autocomplete="tel" required>
        </div>

        <div>
            <label for="f-altPhone">ALTERNATIVE PHONE NO. *</label>
            <input type="tel" id="f-altPhone" name="alternativePhone" autocomplete="tel" required>
        </div>

        <div class="full">
            <label for="f-homeAddress">HOME ADDRESS *</label>
            <textarea id="f-homeAddress" name="homeAddress" rows="2" required></textarea>
        </div>

        <div>
            <label for="f-stateRes">STATE OF RESIDENCE *</label>
            <select id="f-stateRes" name="stateResidence" required>
                <option value="">Select State</option>
            </select>
        </div>

        <div>
            <label for="f-dob">DATE OF BIRTH *</label>
            <input type="date" id="f-dob" name="dateOfBirth" required>
        </div>

        <div>
            <label for="f-lga">LOCAL GOVT *</label>
            <input type="text" id="f-lga" name="localGovernment" required>
        </div>

        <div>
            <label for="f-zone">GEO POLITICAL ZONE *</label>
            <select id="f-zone" name="geopoliticalZone" required>
                <option value="">Select Zone</option>
                <option value="North Central">North Central</option>
                <option value="North East">North East</option>
                <option value="North West">North West</option>
                <option value="South East">South East</option>
                <option value="South South">South South</option>
                <option value="South West">South West</option>
            </select>
        </div>

    </div>

    <button class="btn btn-primary" type="submit" style="width:100%;padding:12px;margin-top:5px;">
        Submit application
    </button>
    <p id="form-msg" class="msg"></p>
</form>

<section class="card dashboard-card">
    <h2 class="section-heading">My Applications</h2>
    <p class="section-description">Review your previous applications and their current status.</p>

    <div class="table-wrapper">
        <table class="applications-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Reference</th>
                    <th>Service</th>
                    <th>Submitted</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="apps-list">
                <tr>
                    <td colspan="5" style="text-align:center;">Loading applications...</td>
                </tr>
            </tbody>
        </table>
    </div>
</section>

<section class="customer-care-banner">
    <div>
        <h2>Customer Support</h2>
        <p>Need assistance with your account or a service enquiry? Contact our Customer Care team for help.</p>
    </div>
    <a href="support.html">Contact Support</a>
</section>

</main><footer class="site-footer">
    <div class="wrap">
        <p>&copy; 2026 EIS Digital Services. All rights reserved.</p>
    </div>
</footer><script type="module" src="js/dashboard.js?v=22"></script></body>
</html>
