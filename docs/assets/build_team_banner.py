import json

def main():
    with open('docs/assets/avatars_b64.json', 'r', encoding='utf-8') as f:
        avatars = json.load(f)

    members = [
        {
            'user': 'Cell1991', 'name': 'Chu', 'role': '👑 LEAD ARCHITECT', 'sub': 'Core Game Engine',
            'color': '#f59e0b', 'bg': '#78350f', 'border': '#f59e0b', 'text_role': '#fde68a', 'text_name': '#fbbf24',
            'x': 25, 'w': 180, 'glow': 'anim-lead-glow'
        },
        {
            'user': 'friend47', 'name': 'Peerapatr', 'role': '⚡ MULTIPLAYER', 'sub': 'WebSocket &amp; Sync',
            'color': '#0284c7', 'bg': '#0369a1', 'border': '#38bdf8', 'text_role': '#7dd3fc', 'text_name': '#38bdf8',
            'x': 220, 'w': 180, 'glow': ''
        },
        {
            'user': 'waiwaix43', 'name': 'waiwaix43', 'role': '🤖 AI BOT TRIAD', 'sub': 'Bot Heuristics',
            'color': '#c084fc', 'bg': '#581c87', 'border': '#c084fc', 'text_role': '#e9d5ff', 'text_name': '#c084fc',
            'x': 415, 'w': 180, 'glow': ''
        },
        {
            'user': 'Natthaset2547', 'name': 'Natthaset', 'role': '📖 LEXICON', 'sub': 'Grimoire Lexicon',
            'color': '#10b981', 'bg': '#064e3b', 'border': '#10b981', 'text_role': '#6ee7b7', 'text_name': '#34d399',
            'x': 610, 'w': 180, 'glow': ''
        },
        {
            'user': 'Rednoselittledog', 'name': 'Kanin Noisiri', 'role': '🎨 CANVAS &amp; FX', 'sub': '60 FPS Engine',
            'color': '#f43f5e', 'bg': '#881337', 'border': '#f43f5e', 'text_role': '#fca5a5', 'text_name': '#fb7185',
            'x': 805, 'w': 180, 'glow': ''
        },
        {
            'user': 'ReFresh-bit', 'name': 'ReFresh-bit', 'role': '🐳 DEVOPS &amp; DB', 'sub': 'Docker &amp; Gateway',
            'color': '#38bdf8', 'bg': '#0369a1', 'border': '#38bdf8', 'text_role': '#7dd3fc', 'text_name': '#38bdf8',
            'x': 1000, 'w': 175, 'glow': ''
        }
    ]

    svg_cards = []
    for i, m in enumerate(members):
        u = m['user']
        b64 = avatars.get(u, '')
        clip_id = f'clip_avatar_{i}'
        glow_class = f' class="{m["glow"]}"' if m['glow'] else ''
        mid_x = m['x'] + m['w'] // 2
        
        card = f'''  <!-- MEMBER {i+1}: {u} -->
  <a href="https://github.com/{u}" target="_parent">
    <g transform="translate({m['x']}, 42)" filter="url(#teamShadow)">
      <rect width="{m['w']}" height="175" rx="12" fill="#0f172a" stroke="{m['border']}" stroke-width="1.5"{glow_class}/>
      <rect x="0" y="0" width="{m['w']}" height="24" rx="12" fill="{m['bg']}" fill-opacity="0.4"/>
      <text x="{m['w']//2}" y="16" fill="{m['text_role']}" font-family="'Inter', -apple-system, sans-serif" font-size="9" font-weight="900" text-anchor="middle" letter-spacing="1">{m['role']}</text>
      
      <!-- Avatar Circle Frame with Embedded Base64 Image -->
      <clipPath id="{clip_id}">
        <circle cx="{m['w']//2}" cy="62" r="28"/>
      </clipPath>
      <circle cx="{m['w']//2}" cy="62" r="28" fill="#1e293b"/>
      <image href="{b64}" xlink:href="{b64}" x="{m['w']//2 - 28}" y="34" width="56" height="56" clip-path="url(#{clip_id})" preserveAspectRatio="xMidYMid slice"/>
      <circle cx="{m['w']//2}" cy="62" r="28" fill="none" stroke="{m['color']}" stroke-width="2"/>

      <text x="{m['w']//2}" y="112" fill="#f8fafc" font-family="'Inter', sans-serif" font-size="12" font-weight="900" text-anchor="middle">{u}</text>
      <text x="{m['w']//2}" y="128" fill="{m['text_name']}" font-family="'Inter', sans-serif" font-size="10" font-weight="700" text-anchor="middle">{m['name']}</text>
      <rect x="18" y="142" width="{m['w'] - 36}" height="20" rx="6" fill="#020617" stroke="#334155" stroke-width="0.8"/>
      <text x="{m['w']//2}" y="155" fill="#94a3b8" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" text-anchor="middle">{m['sub']}</text>
    </g>
  </a>'''
        svg_cards.append(card)

    cards_content = '\n\n'.join(svg_cards)

    full_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 240" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="teamBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95"/>
      <stop offset="60%" stop-color="#090d16" stop-opacity="0.98"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="1"/>
    </radialGradient>

    <!-- Shadow -->
    <filter id="teamShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
    </filter>

    <style>
      @keyframes slowLeadGlow {{
        0%, 100% {{ stroke-opacity: 0.4; }}
        50% {{ stroke-opacity: 1.0; }}
      }}
      .anim-lead-glow {{ animation: slowLeadGlow 4s ease-in-out infinite; }}
    </style>
  </defs>

  <!-- Container Base -->
  <rect width="1200" height="240" fill="url(#teamBg)" rx="16"/>

  <!-- Top Title / HUD Header -->
  <g transform="translate(600, 24)">
    <text x="0" y="0" fill="#64748b" font-family="'Inter', sans-serif" font-size="10" font-weight="900" text-anchor="middle" letter-spacing="4">
      CROSSWORD COMBAT ARENA • CORE DEVELOPMENT CREW
    </text>
  </g>

{cards_content}
</svg>
'''

    with open('docs/assets/team-banner.svg', 'w', encoding='utf-8') as f:
        f.write(full_svg)

    print('team-banner.svg successfully written with embedded Base64 avatars!')

if __name__ == '__main__':
    main()
