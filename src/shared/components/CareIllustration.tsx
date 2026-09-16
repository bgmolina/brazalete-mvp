export function CareIllustration({ variant = 'care' }: { variant?: 'care' | 'device' }) {
  if (variant === 'device')
    return (
      <svg
        viewBox="0 0 320 240"
        role="img"
        aria-label="Ilustración de una pulsera lista para conectar"
        className="device-illustration"
      >
        <ellipse cx="160" cy="214" rx="94" ry="13" fill="#e2e9de" />
        <circle cx="163" cy="117" r="91" fill="#edf2e7" />
        <path d="M128 25q30-13 58 0l10 57h-77zM119 169h77l-10 48q-29 11-56 0z" fill="#779687" />
        <rect x="105" y="68" width="108" height="115" rx="31" fill="#194d42" />
        <rect x="114" y="77" width="90" height="97" rx="24" fill="#f5f6e9" />
        <path
          d="M128 129h14l8-20 13 38 9-22h17"
          fill="none"
          stroke="#4b7c60"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="212" y="108" width="6" height="22" rx="3" fill="#194d42" />
        <path
          d="M239 87q18 19 0 38m13-51q30 31 0 62"
          stroke="#96b19c"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="74" cy="81" r="19" fill="#dce8ce" />
        <path
          d="m65 81 6 6 12-12"
          stroke="#49744d"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )
  return (
    <svg
      viewBox="0 0 500 390"
      role="img"
      aria-label="Ilustración de una cuidadora acompañando a una persona mayor"
      className="care-illustration"
    >
      <path
        d="M55 310C-5 218 63 55 206 38c161-20 284 102 228 234-42 99-279 135-379 38"
        fill="#dbe6cf"
      />
      <circle cx="384" cy="70" r="30" fill="#f5deb2" />
      <path
        d="M399 303V183m0 85q-64-9-58-57 51-4 58 57m0-43q56-4 60-55-53-4-60 55"
        fill="#8aa787"
        stroke="#54765c"
        strokeWidth="3"
      />
      <path d="M373 301h58l-8 48h-44z" fill="#c29372" />
      <rect x="107" y="247" width="252" height="42" rx="15" fill="#b5bd94" />
      <path d="M125 286v65m215-65v65" stroke="#536b54" strokeWidth="12" strokeLinecap="round" />
      <path d="m180 253-5 81h-29l-2-96m86 13 26 80h-31l-32-71" fill="#b48c6e" />
      <path d="M149 331h30l4 20h-57q-3-15 23-20m77 0h29l14 20h-53z" fill="#365750" />
      <path d="M155 151q-29 21-24 73l9 36h103l-7-79q-8-32-39-33" fill="#eef0db" />
      <path d="M162 151v-28h39v29q-18 14-39 0" fill="#d8a785" />
      <ellipse cx="180" cy="107" rx="35" ry="43" fill="#e3b798" />
      <path d="M146 111q-23-58 21-61 29-16 46 22l-9 18q-14-14-34-9l-10 33z" fill="#f3f2e7" />
      <path d="M151 105h23m10 0h22m-32 0h10" stroke="#486458" strokeWidth="3" />
      <rect
        x="152"
        y="98"
        width="22"
        height="18"
        rx="7"
        fill="none"
        stroke="#486458"
        strokeWidth="3"
      />
      <rect
        x="184"
        y="98"
        width="22"
        height="18"
        rx="7"
        fill="none"
        stroke="#486458"
        strokeWidth="3"
      />
      <path
        d="M176 128q8 7 16-1"
        stroke="#9d684e"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M156 178q-23 53 24 56h67"
        stroke="#e3b798"
        strokeWidth="19"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M173 152q-20 1-26 31l23 10 19-37" fill="#e2e6c9" />
      <path d="m279 252-10 78h29l26-80m-10-3 18 83h31l-18-96" fill="#52786b" />
      <path d="M270 330h27v21h-51q-2-15 24-21m63 0h29l17 21h-53z" fill="#27483e" />
      <path d="M285 151q-40 6-39 75l14 37h83l4-64q-4-44-29-49" fill="#639084" />
      <path d="M278 99q-11-62 29-54 40-1 38 54l-7 54h-57z" fill="#3a5146" />
      <path d="M292 148v-27h25v31z" fill="#c9926e" />
      <ellipse cx="307" cy="100" rx="27" ry="37" fill="#d5a17b" />
      <path d="M278 96q4-40 29-39 25 0 29 34-25-4-35-26-4 23-23 31" fill="#3a5146" />
      <path
        d="M299 117q7 6 13 0"
        stroke="#925d45"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M281 176q-12 43-38 52l-29-1"
        stroke="#d5a17b"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M276 153q-18 7-15 36l24 7 15-41" fill="#79a195" />
      <rect x="223" y="220" width="13" height="19" rx="4" fill="#3c6958" />
      <rect x="226" y="224" width="7" height="10" rx="2" fill="#dceace" />
      <path d="M81 146c-14-19-36 1 0 22 36-21 14-41 0-22" fill="#c98978" />
      <path d="m240 75 7-16m2 27 18-5" stroke="#94ad8b" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
export function PersonAvatar() {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Avatar ilustrado de la persona"
      className="person-avatar"
    >
      <rect width="64" height="64" rx="22" fill="#e9ddcd" />
      <path d="M9 64q-1-26 23-26 23 0 23 26" fill="#6e8b6a" />
      <path d="M18 36q-9-33 14-30 23-2 15 30z" fill="#f4f2e5" />
      <ellipse cx="32" cy="29" rx="14" ry="18" fill="#d9aa88" />
      <path d="M17 26q-1-21 15-19 17 0 15 20-14-1-22-11z" fill="#eeeee0" />
      <path
        d="M27 35q5 5 10-1"
        stroke="#905d45"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="27" cy="27" r="1" fill="#464839" />
      <circle cx="38" cy="27" r="1" fill="#464839" />
    </svg>
  )
}
