# 🔦 Beacon — AI-Powered Benefits Eligibility Guide

> Discover which public assistance programs you qualify for — free, private, and under 5 minutes.

Built as part of my **Claude Corps Fellow** application. Beacon is a conversational AI tool that helps low-income individuals and families navigate the complex U.S. public benefits system.

---

## 🎯 What It Does

Most people don't apply for benefits they qualify for — not because they're ineligible, but because the system is confusing and fragmented. Beacon fixes that.

A user answers 7 simple questions in a friendly chat interface. Claude AI analyzes their responses and identifies which programs they may qualify for, then provides clear next steps to apply.

---

## ✨ Features

- 💬 **Conversational screening** — Claude asks one question at a time, no overwhelming forms
- 🛡️ **Private by design** — no data stored, no accounts required
- 📊 **Results dashboard** — clear list of eligible programs with next steps
- ⬇️ **Downloadable results** — users can save a plain-text summary
- 📋 **Google Sheets logging** — session data can be exported for nonprofit case workers

---

## 🏛️ Programs Screened

| Program | What It Covers |
|---------|----------------|
| SNAP | Food assistance |
| Medicaid | Free/low-cost health coverage |
| CHIP | Children's health insurance |
| WIC | Nutrition for women, infants & children |
| LIHEAP | Utility bill assistance |
| Section 8 / HCV | Housing vouchers |
| TANF | Temporary cash assistance for families |
| SSI | Income support for elderly/disabled |
| Head Start | Early childhood education |
| Free/Reduced Lunch | School meal programs |

---

## 🛠️ Tech Stack

- **Frontend** — React + Vite
- **AI** — Anthropic Claude API (claude-sonnet-4-6)
- **Deployment** — Vercel

---

## 🚀 Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/beacon.git
cd beacon

# 2. Install dependencies
npm install

# 3. Add your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=your_key_here" > .env.local

# 4. Start the dev server
npm run dev
```

---

## 🌍 Why I Built This

The Claude Corps Fellowship places AI fellows inside nonprofits and public-interest organizations to build tools that matter. Beacon is my proof-of-concept for exactly that mission — using Claude to make government services more accessible to people who need them most.

---

## 📬 Contact

Built by **Aditya** · [GitHub](https://github.com/YOUR_USERNAME)

---

*This tool does not provide official eligibility determinations. Always verify with your local benefits office or visit [benefits.gov](https://benefits.gov).*
