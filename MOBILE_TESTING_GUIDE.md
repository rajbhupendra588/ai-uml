# Mobile Testing Guide for ArchitectAI

## Quick Start - Test Mobile Preview Now

### Method 1: Chrome DevTools (Easiest & Recommended)

#### Step 1: Start the Development Server
```bash
cd /Users/bhupendra/Documents/prpo1/frontend
npm run dev
```

#### Step 2: Open in Browser
- Open Chrome or Edge browser
- Navigate to: `http://localhost:3000` (or the port shown in terminal)

#### Step 3: Enable Device Toolbar
**Option A - Keyboard Shortcut:**
- **Mac**: `Cmd + Option + M`
- **Windows/Linux**: `Ctrl + Shift + M`

**Option B - Menu:**
1. Press `F12` to open DevTools
2. Click the "Toggle device toolbar" icon (📱) in the top-left of DevTools
3. Or click the three dots menu → "More tools" → "Toggle device toolbar"

#### Step 4: Select a Device
In the device toolbar at the top:
- Click the device dropdown (default: "Responsive")
- Choose a device:
  - **iPhone 14 Pro** (390 x 844) - Modern iPhone
  - **iPhone SE** (375 x 667) - Smaller iPhone
  - **Pixel 7** (412 x 915) - Android phone
  - **iPad Air** (820 x 1180) - Tablet
  - **Responsive** - Custom size (drag to resize)

#### Step 5: Test Features
✅ **Toolbar**: Should be compact with icon-only buttons
✅ **Sidebar**: Click "Architect" button - should slide in as full-screen overlay
✅ **Backdrop**: Click dark area outside sidebar to close it
✅ **Touch Targets**: All buttons should be easy to tap (44px minimum)
✅ **Scrolling**: Toolbar should scroll horizontally if needed
✅ **Zoom**: Try pinch-to-zoom gesture (or use DevTools zoom controls)

---

## Method 2: Firefox Responsive Design Mode

#### Step 1: Open Firefox
- Navigate to `http://localhost:3000`

#### Step 2: Enable Responsive Mode
- **Mac**: `Cmd + Option + M`
- **Windows/Linux**: `Ctrl + Shift + M`

#### Step 3: Select Device
- Choose from preset devices or set custom dimensions
- Test portrait and landscape orientations

---

## Method 3: Safari Responsive Design Mode (Mac Only)

#### Step 1: Enable Developer Menu
1. Open Safari → Preferences → Advanced
2. Check "Show Develop menu in menu bar"

#### Step 2: Enter Responsive Mode
1. Navigate to `http://localhost:3000`
2. Menu: Develop → Enter Responsive Design Mode
3. Or press: `Cmd + Option + R`

#### Step 3: Test
- Select different device presets
- Test iOS-specific features

---

## Method 4: Test on Real Mobile Device (Best for Final Testing)

### Option A: Same WiFi Network

#### Step 1: Find Your Computer's IP Address

**Mac:**
```bash
ipconfig getifaddr en0
```

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

**Linux:**
```bash
hostname -I | awk '{print $1}'
```

#### Step 2: Start Dev Server
```bash
cd /Users/bhupendra/Documents/prpo1/frontend
npm run dev
```

Look for the "Network" URL in the output:
```
- Local:    http://localhost:3000
- Network:  http://192.168.1.7:3000  ← Use this!
```

#### Step 3: Access from Mobile
1. Make sure your phone is on the **same WiFi network**
2. Open browser on your phone
3. Enter the Network URL (e.g., `http://192.168.1.7:3000`)

### Option B: Using ngrok (Access from Anywhere)

#### Step 1: Install ngrok
```bash
# Mac (using Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

#### Step 2: Start Dev Server
```bash
cd /Users/bhupendra/Documents/prpo1/frontend
npm run dev
```

#### Step 3: Create Tunnel
In a new terminal:
```bash
ngrok http 3000
```

#### Step 4: Use Public URL
- ngrok will show a public URL like: `https://abc123.ngrok.io`
- Open this URL on any mobile device (even over cellular data!)

---

## Method 5: Browser Extensions

### Responsive Viewer (Chrome Extension)
1. Install from Chrome Web Store: "Responsive Viewer"
2. Click extension icon
3. View multiple device sizes simultaneously

---

## Testing Checklist

### 📱 Mobile Phone (< 640px)

- [ ] **Toolbar**
  - [ ] Compact spacing (gap-2)
  - [ ] "New" button shows only icon
  - [ ] "Diagram:" label is hidden
  - [ ] Undo/Redo buttons are hidden
  - [ ] Toolbar scrolls horizontally if needed

- [ ] **Sidebar (Architect Panel)**
  - [ ] Opens as full-screen overlay
  - [ ] Slides in from right with animation
  - [ ] Shows dark backdrop behind it
  - [ ] Clicking backdrop closes the panel
  - [ ] Close button (X) works

- [ ] **Input/Prompt Area**
  - [ ] Text size is readable (14px)
  - [ ] Buttons are touch-friendly (44px)
  - [ ] Voice input button visible and works
  - [ ] Submit button is easy to tap

- [ ] **Canvas/Diagram**
  - [ ] Diagram is visible and zoomable
  - [ ] ReactFlow controls are in bottom-right
  - [ ] Minimap is hidden
  - [ ] Can pan and zoom diagram

### 📱 Tablet (768px - 1024px)

- [ ] Sidebar starts to show as traditional sidebar
- [ ] More toolbar elements visible
- [ ] Font size increases to 15px
- [ ] Better spacing overall

### 💻 Desktop (> 1024px)

- [ ] All toolbar elements visible
- [ ] Sidebar is traditional 384px width
- [ ] Full feature set available
- [ ] Optimal spacing and typography

---

## Common Issues & Solutions

### Issue: Can't access from mobile on same network
**Solution:**
- Check firewall settings
- Make sure both devices are on same WiFi
- Try using ngrok instead

### Issue: Sidebar doesn't slide in smoothly
**Solution:**
- Check browser console for errors
- Clear browser cache
- Try in incognito/private mode

### Issue: Touch targets too small
**Solution:**
- Check if CSS loaded correctly
- Verify min-height: 44px is applied
- Test in actual mobile browser (not just DevTools)

### Issue: Horizontal scrolling appears
**Solution:**
- This is expected for toolbar when many items present
- Verify `overflow-x: hidden` on body
- Check for elements with fixed widths

---

## Performance Testing on Mobile

### Chrome DevTools Performance
1. Open DevTools → Performance tab
2. Enable "CPU: 4x slowdown" to simulate slower mobile CPU
3. Enable "Network: Fast 3G" to simulate mobile network
4. Record and analyze performance

### Lighthouse Mobile Audit
1. Open DevTools → Lighthouse tab
2. Select "Mobile" device
3. Run audit
4. Check scores for:
   - Performance
   - Accessibility
   - Best Practices
   - SEO

---

## Quick Commands Reference

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Find your IP (Mac)
ipconfig getifaddr en0

# Start ngrok tunnel
ngrok http 3000
```

---

## Recommended Testing Flow

1. **Start with Chrome DevTools** - Quick iteration
2. **Test multiple device sizes** - iPhone SE, iPhone 14, iPad
3. **Test on real device** - At least once before deploying
4. **Run Lighthouse audit** - Check performance scores
5. **Test touch interactions** - Ensure everything is tappable

---

## Screenshots to Take

When testing, capture:
- [ ] Mobile view with sidebar closed
- [ ] Mobile view with sidebar open (overlay)
- [ ] Tablet view
- [ ] Desktop view
- [ ] Toolbar horizontal scroll (if applicable)
- [ ] Diagram zoom/pan on mobile

---

## Next Steps After Testing

1. Note any issues in a GitHub issue or document
2. Test on both iOS Safari and Chrome Android
3. Verify all features work on mobile
4. Check loading performance on 3G
5. Test with screen readers for accessibility
