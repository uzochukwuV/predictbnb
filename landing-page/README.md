# PredictBNB Landing Page

Production-ready landing page for PredictBNB - Gaming Oracle Protocol.

## Features

- **Responsive Design** - Works on all devices (mobile, tablet, desktop)
- **Modern UI/UX** - BNB Chain yellow (#F3BA2F) + Gaming purple (#6B46C1) color scheme
- **Smooth Animations** - Fade-in effects, counter animations, parallax scrolling
- **SEO Optimized** - Meta tags for social sharing
- **Fast Loading** - Pure HTML/CSS/JS, no frameworks required
- **Accessibility** - Semantic HTML and ARIA labels

## File Structure

```
landing-page/
├── index.html      # Main HTML file
├── styles.css      # All styling and animations
├── script.js       # Interactive features and animations
└── README.md       # This file
```

## Deployment Options

### 1. Vercel (Recommended - FREE)

**Already Deployed:** https://predictbnb-9tgd.vercel.app/

To update:
```bash
# Install Vercel CLI (one time)
npm install -g vercel

# Deploy from landing-page directory
cd landing-page
vercel

# For production deployment
vercel --prod
```

### 2. GitHub Pages (FREE)

```bash
# 1. Create gh-pages branch
git checkout -b gh-pages

# 2. Copy landing page files to root
cp landing-page/* .

# 3. Commit and push
git add .
git commit -m "Deploy landing page"
git push origin gh-pages

# 4. Enable GitHub Pages in repo settings
# Settings > Pages > Source: gh-pages branch
```

**URL will be:** `https://uzochukwuV.github.io/predictbnb/`

### 3. Netlify (FREE)

1. Go to https://www.netlify.com
2. Drag and drop the `landing-page` folder
3. Get instant URL: `https://predictbnb.netlify.app`

### 4. Custom Domain

**Steps to connect custom domain (predictbnb.com):**

1. Buy domain from Namecheap/GoDaddy ($12/year)
2. Add CNAME record pointing to your Vercel/Netlify URL
3. Configure custom domain in hosting platform settings

## Customization

### Colors

Edit `styles.css` variables:
```css
:root {
    --bnb-yellow: #F3BA2F;      /* BNB Chain brand color */
    --gaming-purple: #6B46C1;   /* Gaming accent */
    --dark-bg: #0F0F23;         /* Main background */
    --card-bg: #1A1A2E;         /* Card background */
}
```

### Content

Edit `index.html`:
- Update links in navigation
- Change hero text
- Modify feature cards
- Update footer links

### Social Links

Update in `index.html`:
- Twitter: Replace `#` with your Twitter URL when created
- Discord: Already set to `https://discord.gg/gBWntrV8`
- Telegram: Replace `#` with your Telegram group when created

## Features Breakdown

### Hero Section
- Gradient title with BNB/Purple colors
- 4 key stats (70% savings, 15min, 80%, 20%)
- CTA buttons for GitHub and docs

### Features Grid
- 6 feature cards with icons
- Hover effects with border color change
- Detailed descriptions

### How It Works
- 4-step process with numbered badges
- Code examples for each step
- Sequential animation on scroll

### Tech Stack
- Technology grid display
- Feature badges (gas-optimized, audited, etc.)

### Stats Section
- 4 key metrics with large numbers
- Counter animation on scroll

### CTA Section
- Final call-to-action
- Gradient background effect

### Footer
- 3-column layout (Product, Resources, Community)
- Social links
- Copyright notice

## Performance

- **Load Time:** < 1 second
- **Size:** ~50KB total (HTML + CSS + JS)
- **Mobile-First:** Responsive breakpoints at 768px
- **Animations:** Hardware-accelerated CSS transitions

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## SEO

Included meta tags:
- Open Graph tags for social sharing
- Description and keywords
- Proper heading hierarchy (h1 → h6)
- Semantic HTML5 elements

## Analytics (Optional)

To add Google Analytics:

```html
<!-- Add before </head> in index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Troubleshooting

**Issue: Fonts not loading**
- Using system fonts, should work everywhere
- Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI'

**Issue: Animations not working**
- Check JavaScript console for errors
- Ensure `script.js` is loaded

**Issue: Mobile menu not showing**
- Check viewport meta tag in HTML
- Verify media queries in CSS

## Local Development

```bash
# No build process required!
# Just open in browser:
open index.html

# Or use a local server:
python3 -m http.server 8000
# Visit: http://localhost:8000
```

## Next Steps

1. ✅ Landing page created
2. ✅ Deployed to Vercel
3. ⏱️ Create Twitter account (@PredictBNB)
4. ⏱️ Create simple logo (Canva/Looka)
5. ⏱️ Add Twitter link to footer
6. ⏱️ Consider custom domain (predictbnb.com)

## Links

- **Live Site:** https://predictbnb-9tgd.vercel.app/
- **GitHub:** https://github.com/uzochukwuV/predictbnb
- **Discord:** https://discord.gg/gBWntrV8

## License

MIT License - Feel free to customize and use!

---

Built with ❤️ for gaming prediction markets on BNB Chain
