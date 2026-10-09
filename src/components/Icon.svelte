<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
  const paths: Record<string, string> = {
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    chart: 'M4 4v16h17M8 8h11M8 12h7M8 16h9',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    collapse: 'M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5',
    logo: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 2l3 3m5-3-3 3M8 11v4m8-4v4m-8 3h8',
    map: 'M5 9h5v6H5zM17 3h4v4h-4zM17 17h4v4h-4zM3 12h2m5 0h3m0-7v14m0-14h4m-4 14h4',
    file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8m-8 4h6',
    subtitles:
      'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM6 9h3m3 0h6M6 13h7m3 0h2M6 17h12',
    // Primer Octicons GitHub mark; MIT license in THIRD_PARTY_NOTICES.md.
    github:
      'M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943',
    settings:
      'M9 3h6l.6 3 2.6 1.5 2.9-1 3 5.2-2.3 2v3l2.3 2-3 5.2-2.9-1L15.6 24l-.6 3H9l-.6-3-2.6-1.5-2.9 1-3-5.2 2.3-2v-3l-2.3-2 3-5.2 2.9 1L8.4 6ZM16 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    refresh:
      'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17',
    sparkles:
      'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4M3 18v4m-2-2h4',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
    image:
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 17l6-6 4 4 3-3 5 5M16 7h.01',
    copy: 'M9 8h11v13H9zM15 4H4v13',
    check: 'm5 12 4 4L20 5',
    x: 'm6 6 12 12M6 18 18 6',
    back: 'm13 5-7 7 7 7M6 12h15',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M9 9h6v6H9z',
    search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    stop: 'M6 6h12v12H6z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    'eye-off':
      'm3 3 18 18M10 5h2c6.5 0 10 7 10 7a19 19 0 0 1-4 4M6 6a18 18 0 0 0-4 6s3.5 7 10 7a13 13 0 0 0 5-1M9 9a4 4 0 0 0 6 6',
    plug: 'M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4',
    save: 'M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-7h10v7',
    code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    external: 'M14 3h7v7m0-7-11 11M10 3H3v18h18v-7',
    chevron: 'm6 9 6 6 6-6',
    sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
    moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10',
    monitor: 'M3 3h18v14H3zM12 17v4m-5 0h10',
    alert: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
    play: 'm8 4 12 8-12 8Z',
    info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10h.01',
    loader: 'M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9',
    key: 'M14 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM13 12l8 8m-3-3-3 3m0-6-3 3',
  };
</script>

<svg
  width={size}
  height={size}
  viewBox={name === 'settings' ? '-2 0 28 30' : '0 0 24 24'}
  fill={name === 'github' ? 'currentColor' : 'none'}
  stroke={name === 'github' ? 'none' : 'currentColor'}
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class:spinning={name === 'loader'}
>
  <path d={paths[name] || paths.info} />
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
  .spinning {
    animation: turn 1s linear infinite;
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinning {
      animation: none;
    }
  }
</style>
