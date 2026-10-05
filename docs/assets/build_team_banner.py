import json
import urllib.request
import base64

def download_avatars(users):
    avatars = {}
    headers = {'User-Agent': 'Mozilla/5.0'}
    for u in users:
        # Fetch larger 200x200 high-res avatar
        url = f'https://github.com/{u}.png?size=200'
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                b64 = base64.b64encode(data).decode('utf-8')
                avatars[u] = f'data:image/png;base64,{b64}'
                print(f'{u}: {len(data)} bytes -> Base64 OK')
        except Exception as e:
            print(f'{u} error: {e}')
    return avatars

def main():
    members = [
        {
            'user': 'Cell1991', 'name': 'Cell',
            'color': '#f59e0b', 'border': '#f59e0b', 'text_name': '#fbbf24',
            'x': 25, 'w': 180, 'glow': 'anim-lead-glow'
        },
        {
            'user': 'friend47', 'name': 'Peerapatr',
            'color': '#0284c7', 'border': '#38bdf8', 'text_name': '#38bdf8',
            'x': 220, 'w': 180, 'glow': 'anim-card-glow'
        },
        {
            'user': 'waiwaix43', 'name': 'waiwaix43',
            'color': '#c084fc', 'border': '#c084fc', 'text_name': '#c084fc',
            'x': 415, 'w': 180, 'glow': 'anim-card-glow'
        },
        {
            'user': 'Natthaset2547', 'name': 'Natthaset',
            'color': '#10b981', 'border': '#10b981', 'text_name': '#34d399',
            'x': 610, 'w': 180, 'glow': 'anim-card-glow'
        },
        {
            'user': 'Rednoselittledog', 'name': 'Kanin Noisiri',
            'color': '#f43f5e', 'border': '#f43f5e', 'text_name': '#fb7185',
            'x': 805, 'w': 180, 'glow': 'anim-card-glow'
        },
        {
            'user': 'ReFresh-bit', 'name': 'ReFresh-bit',
            'color': '#38bdf8', 'border': '#38bdf8', 'text_name': '#38bdf8',
            'x': 1000, 'w': 175, 'glow': 'anim-card-glow'
        }
    ]

    users = [m['user'] for m in members]
    avatars = download_avatars(users)

    svg_cards = []
    for i, m in enumerate(members):
        u = m['user']
        b64 = avatars.get(u, '')
        clip_id = f'clip_avatar_{i}'
        glow_class = f' class="{m["glow"]}"' if m['glow'] else ''
        mid_x = m['w'] // 2
        r = 44  # Large 88px diameter avatar!
        
        card = f'''  <!-- MEMBER {i+1}: {u} -->
  <a href="https://github.com/{u}" target="_parent">
    <g transform="translate({m['x']}, 42)" filter="url(#teamShadow)">
      <!-- Card Container Box -->
      <rect width="{m['w']}" height="185" rx="14" fill="#0f172a" stroke="{m['border']}" stroke-width="1.6"{glow_class}/>
      
      <!-- Top Subtle Glow Line -->
      <path d="M 20 0 L {m['w'] - 20} 0" stroke="{m['color']}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>

      <!-- Large Circular Avatar Frame (Diameter 88px) -->
      <clipPath id="{clip_id}">
        <circle cx="{mid_x}" cy="65" r="{r}"/>
      </clipPath>
      <circle cx="{mid_x}" cy="65" r="{r}" fill="#1e293b"/>
      <image href="{b64}" xlink:href="{b64}" x="{mid_x - r}" y="{65 - r}" width="{r*2}" height="{r*2}" clip-path="url(#{clip_id})" preserveAspectRatio="xMidYMid slice"/>
      <circle cx="{mid_x}" cy="65" r="{r}" fill="none" stroke="{m['color']}" stroke-width="2.5"/>

      <!-- Member Names (No Roles) -->
      <text x="{mid_x}" y="138" fill="#f8fafc" font-family="'Inter', sans-serif" font-size="14.5" font-weight="900" text-anchor="middle">{u}</text>
      <text x="{mid_x}" y="158" fill="{m['text_name']}" font-family="'Inter', sans-serif" font-size="12.5" font-weight="700" text-anchor="middle">{m['name']}</text>
    </g>
  </a>'''
        svg_cards.append(card)

    cards_content = '\n\n'.join(svg_cards)

    full_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 250" width="100%" height="100%">
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
      @keyframes slowCardGlow {{
        0%, 100% {{ stroke-opacity: 0.35; }}
        50% {{ stroke-opacity: 0.85; }}
      }}
      .anim-lead-glow {{ animation: slowLeadGlow 4s ease-in-out infinite; }}
      .anim-card-glow {{ animation: slowCardGlow 5s ease-in-out infinite; }}
    </style>
  </defs>

  <!-- Container Base -->
  <rect width="1200" height="250" fill="url(#teamBg)" rx="16"/>

  <!-- Top Title / HUD Header -->
  <g transform="translate(600, 24)">
    <text x="0" y="0" fill="#64748b" font-family="'Inter', sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="3">
      CROSSWORD COMBAT ARENA • CORE DEVELOPMENT CREW
    </text>
  </g>

{cards_content}
</svg>
'''

    with open('docs/assets/team-banner.svg', 'w', encoding='utf-8') as f:
        f.write(full_svg)

    print('team-banner.svg successfully generated with extra-large avatars and clean no-role design!')

if __name__ == '__main__':
    main()
