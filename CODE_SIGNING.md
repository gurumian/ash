# macOS Code Signing Guide

## Overview

This app requires code signing to enable network permissions (SSH, TFTP) in the built macOS app. Without proper entitlements, macOS will block network connections.

## Quick Start

### Option 1: Development Build (No Code Signing Required)

For testing, you can build without code signing. The entitlements will still be applied:

```bash
npm run make
```

However, macOS may show security warnings. To test network functionality:
1. Right-click the app → "Open" (first time only)
2. Or run: `xattr -cr /path/to/ash.app`

### Option 2: Use Existing Apple Development Certificate

If you have an "Apple Development" certificate (for testing):

```bash
# The app will auto-detect and use your development certificate
npm run make
```

### Option 3: Get Developer ID Certificate (For Distribution)

For distributing the app outside the App Store, you need a "Developer ID Application" certificate.

#### Step 1: Check Your Apple Developer Account

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Log in with your Apple Developer account
3. Check if you have a "Developer ID Application" certificate

#### Step 2: Create Certificate Signing Request (CSR)

1. Open **Keychain Access** (Applications > Utilities)
2. Menu: **Keychain Access** > **Certificate Assistant** > **Request a Certificate from a Certificate Authority...**
3. Enter:
   - **User Email Address**: Your email
   - **Common Name**: Your name or company name
   - **CA Email Address**: Leave empty
   - Select **"Saved to disk"**
4. Click **Continue** and save the CSR file

#### Step 3: Create Developer ID Certificate

1. Go to https://developer.apple.com/account/resources/certificates/add
2. Select **"Developer ID Application"**
3. Click **Continue**
4. Upload the CSR file you created
5. Click **Continue** and download the certificate

#### Step 4: Install Certificate

1. Double-click the downloaded `.cer` file
2. It will be installed in Keychain Access under "My Certificates"

#### Step 5: Verify Certificate

```bash
security find-identity -v -p codesigning | grep "Developer ID"
```

You should see something like:
```
Developer ID Application: Your Name (TEAM_ID)
```

#### Step 6: Configure Build

Set the environment variable before building:

```bash
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
npm run make
```

Or add to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

## Notarization (Optional, for Distribution)

Notarization is required for distributing apps outside the App Store. You need:

1. **App-Specific Password** (not your regular Apple ID password):
   - Go to https://appleid.apple.com/account/manage
   - Sign in → App-Specific Passwords → Generate
   - Save the password

2. **Team ID**: Found in your Apple Developer account

3. **Set Environment Variables**:

```bash
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

Then build:

```bash
npm run make
```

## Troubleshooting

### "No identity found"

- Make sure the certificate is installed in Keychain Access
- Check certificate name matches exactly (including spaces and parentheses)
- Verify certificate is not expired

### "Network connection failed" in built app

- Make sure `entitlements.plist` exists and has network permissions
- Rebuild the app after adding entitlements
- Check System Settings > Privacy & Security > Network → Allow your app

### "App is damaged" warning

- This happens when code signing fails
- Right-click → "Open" (first time only)
- Or rebuild with proper code signing

## Current Certificates

To see your available certificates:

```bash
security find-identity -v -p codesigning
```

## References

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Signing Your Apps for Gatekeeper](https://developer.apple.com/developer-id/)

