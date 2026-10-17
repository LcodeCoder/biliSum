import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import { HAND_FONT_FACE } from '../../src/lib/hand-font';
import { themeStyleSheet } from '../../src/lib/theme';

const themeStyles = document.createElement('style');
themeStyles.dataset.bilisumTheme = '';
themeStyles.textContent = HAND_FONT_FACE + themeStyleSheet();
document.head.append(themeStyles);

mount(App, { target: document.getElementById('app')! });
