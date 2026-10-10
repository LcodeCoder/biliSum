import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import { themeStyleSheet } from '../../src/lib/theme';

const themeStyles = document.createElement('style');
themeStyles.dataset.bilisumTheme = '';
themeStyles.textContent = themeStyleSheet();
document.head.append(themeStyles);

mount(App, { target: document.getElementById('app')! });
