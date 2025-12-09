import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconPix, IconCreditCard, IconCash, IconRatingStar } from '../../../lib/icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type BusinessProfile = {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  work_days: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
};

type ReviewStats = {
  average_rating: number;
  total_reviews: number;
};

const backgroundSvg = `
<svg width="390" height="298" viewBox="0 0 390 298" fill="none" xmlns="http://www.w3.org/2000/svg">
<g opacity="0.08">
<path d="M2.20898 -8.7032C2.20898 -9.73957 3.04913 -10.5797 4.0855 -10.5797H20.3144C21.3508 -10.5797 22.1909 -9.73957 22.1909 -8.7032V1.73662C22.1909 2.77299 21.3508 3.61313 20.3144 3.61313H4.08549C3.04913 3.61313 2.20898 2.77299 2.20898 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M26.0547 -8.24849C26.0547 -9.28486 26.8948 -10.125 27.9312 -10.125H65.301C66.3374 -10.125 67.1775 -9.28486 67.1775 -8.24849V1.28154C67.1775 2.31791 66.3374 3.15805 65.301 3.15805H27.9312C26.8948 3.15805 26.0547 2.31791 26.0547 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M48.0332 -8.7032C48.0332 -9.73957 48.8733 -10.5797 49.9097 -10.5797H66.1386C67.175 -10.5797 68.0151 -9.73957 68.0151 -8.7032V1.73662C68.0151 2.77299 67.175 3.61313 66.1386 3.61313H49.9097C48.8733 3.61313 48.0332 2.77299 48.0332 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M71.8789 -8.24849C71.8789 -9.28486 72.719 -10.125 73.7554 -10.125H111.125C112.162 -10.125 113.002 -9.28486 113.002 -8.24849V1.28154C113.002 2.31791 112.162 3.15805 111.125 3.15805H73.7554C72.719 3.15805 71.8789 2.31791 71.8789 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M93.8555 -8.7032C93.8555 -9.73957 94.6956 -10.5797 95.732 -10.5797H111.961C112.997 -10.5797 113.837 -9.73957 113.837 -8.7032V1.73662C113.837 2.77299 112.997 3.61313 111.961 3.61313H95.732C94.6956 3.61313 93.8555 2.77299 93.8555 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M117.701 -8.24849C117.701 -9.28486 118.541 -10.125 119.578 -10.125H156.948C157.984 -10.125 158.824 -9.28486 158.824 -8.24849V1.28154C158.824 2.31791 157.984 3.15805 156.948 3.15805H119.578C118.541 3.15805 117.701 2.31791 117.701 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M139.678 -8.7032C139.678 -9.73957 140.518 -10.5797 141.554 -10.5797H157.783C158.82 -10.5797 159.66 -9.73957 159.66 -8.7032V1.73662C159.66 2.77299 158.82 3.61313 157.783 3.61313H141.554C140.518 3.61313 139.678 2.77299 139.678 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M163.523 -8.24849C163.523 -9.28486 164.364 -10.125 165.4 -10.125H202.77C203.806 -10.125 204.646 -9.28486 204.646 -8.24849V1.28154C204.646 2.31791 203.806 3.15805 202.77 3.15805H165.4C164.364 3.15805 163.523 2.31791 163.523 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M185.5 -8.7032C185.5 -9.73957 186.34 -10.5797 187.377 -10.5797H203.605C204.642 -10.5797 205.482 -9.73957 205.482 -8.7032V1.73662C205.482 2.77299 204.642 3.61313 203.605 3.61313H187.377C186.34 3.61313 185.5 2.77299 185.5 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M209.346 -8.24849C209.346 -9.28486 210.186 -10.125 211.222 -10.125H248.592C249.628 -10.125 250.469 -9.28486 250.469 -8.24849V1.28154C250.469 2.31791 249.628 3.15805 248.592 3.15805H211.222C210.186 3.15805 209.346 2.31791 209.346 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M231.322 -8.7032C231.322 -9.73957 232.162 -10.5797 233.199 -10.5797H249.428C250.464 -10.5797 251.304 -9.73957 251.304 -8.7032V1.73662C251.304 2.77299 250.464 3.61313 249.428 3.61313H233.199C232.162 3.61313 231.322 2.77299 231.322 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M255.168 -8.24849C255.168 -9.28486 256.008 -10.125 257.044 -10.125H294.414C295.451 -10.125 296.291 -9.28486 296.291 -8.24849V1.28154C296.291 2.31791 295.451 3.15805 294.414 3.15805H257.044C256.008 3.15805 255.168 2.31791 255.168 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M277.145 -8.7032C277.145 -9.73957 277.985 -10.5797 279.021 -10.5797H295.25C296.286 -10.5797 297.126 -9.73957 297.126 -8.7032V1.73662C297.126 2.77299 296.286 3.61313 295.25 3.61313H279.021C277.985 3.61313 277.145 2.77299 277.145 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M300.99 -8.24849C300.99 -9.28486 301.83 -10.125 302.867 -10.125H340.237C341.273 -10.125 342.113 -9.28486 342.113 -8.24849V1.28154C342.113 2.31791 341.273 3.15805 340.237 3.15805H302.867C301.83 3.15805 300.99 2.31791 300.99 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M322.967 -8.7032C322.967 -9.73957 323.807 -10.5797 324.843 -10.5797H341.072C342.109 -10.5797 342.949 -9.73957 342.949 -8.7032V1.73662C342.949 2.77299 342.109 3.61313 341.072 3.61313H324.843C323.807 3.61313 322.967 2.77299 322.967 1.73662V-8.7032Z" fill="#000E3D"/>
<path d="M346.812 -8.24849C346.812 -9.28486 347.653 -10.125 348.689 -10.125H386.059C387.095 -10.125 387.935 -9.28486 387.935 -8.24849V1.28154C387.935 2.31791 387.095 3.15805 386.059 3.15805H348.689C347.653 3.15805 346.812 2.31791 346.812 1.28154V-8.24849Z" fill="#000E3D"/>
<path d="M2.20898 7.75737C2.20898 6.721 3.04913 5.88086 4.0855 5.88086H20.3144C21.3508 5.88086 22.1909 6.721 22.1909 7.75737V18.1972C22.1909 19.2336 21.3508 20.0737 20.3144 20.0737H4.08549C3.04913 20.0737 2.20898 19.2336 2.20898 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M2.20898 40.2372C2.20898 39.2009 3.04913 38.3607 4.0855 38.3607H20.3144C21.3508 38.3607 22.1909 39.2009 22.1909 40.2372V50.6771C22.1909 51.7134 21.3508 52.5536 20.3144 52.5536H4.08549C3.04913 52.5536 2.20898 51.7134 2.20898 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M26.0547 7.75737C26.0547 6.721 26.8948 5.88086 27.9312 5.88086H65.301C66.3374 5.88086 67.1775 6.721 67.1775 7.75737V18.1972C67.1775 19.2336 66.3374 20.0737 65.301 20.0737H27.9312C26.8948 20.0737 26.0547 19.2336 26.0547 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M2.20898 24.225C2.20898 23.1887 3.04913 22.3485 4.0855 22.3485H40.3636C41.3999 22.3485 42.2401 23.1887 42.2401 24.225V34.028C42.2401 35.0644 41.3999 35.9045 40.3636 35.9045H4.08549C3.04913 35.9045 2.20898 35.0644 2.20898 34.028V24.225Z" fill="#E5102E"/>
<path d="M45.8887 24.225C45.8887 23.1887 46.7288 22.3485 47.7652 22.3485H65.3014C66.3378 22.3485 67.1779 23.1887 67.1779 24.225V34.028C67.1779 35.0644 66.3378 35.9045 65.3014 35.9045H47.7652C46.7288 35.9045 45.8887 35.0644 45.8887 34.028V24.225Z" fill="#000E3D"/>
<path d="M26.0547 40.6919C26.0547 39.6556 26.8948 38.8154 27.9312 38.8154H65.301C66.3374 38.8154 67.1775 39.6556 67.1775 40.6919V50.222C67.1775 51.2583 66.3374 52.0985 65.301 52.0985H27.9312C26.8948 52.0985 26.0547 51.2583 26.0547 50.222V40.6919Z" fill="#000E3D"/>
<path d="M48.0332 7.75737C48.0332 6.721 48.8733 5.88086 49.9097 5.88086H66.1386C67.175 5.88086 68.0151 6.721 68.0151 7.75737V18.1972C68.0151 19.2336 67.175 20.0737 66.1386 20.0737H49.9097C48.8733 20.0737 48.0332 19.2336 48.0332 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M48.0332 40.2372C48.0332 39.2009 48.8733 38.3607 49.9097 38.3607H66.1386C67.175 38.3607 68.0151 39.2009 68.0151 40.2372V50.6771C68.0151 51.7134 67.175 52.5536 66.1386 52.5536H49.9097C48.8733 52.5536 48.0332 51.7134 48.0332 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M71.8789 7.75737C71.8789 6.721 72.719 5.88086 73.7554 5.88086H111.125C112.162 5.88086 113.002 6.721 113.002 7.75737V18.1972C113.002 19.2336 112.162 20.0737 111.125 20.0737H73.7554C72.719 20.0737 71.8789 19.2336 71.8789 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M48.0332 24.225C48.0332 23.1887 48.8733 22.3485 49.9097 22.3485H86.1878C87.2242 22.3485 88.0643 23.1887 88.0643 24.225V34.028C88.0643 35.0644 87.2242 35.9045 86.1878 35.9045H49.9097C48.8733 35.9045 48.0332 35.0644 48.0332 34.028V24.225Z" fill="#E5102E"/>
<path d="M91.7129 24.225C91.7129 23.1887 92.553 22.3485 93.5894 22.3485H111.126C112.162 22.3485 113.002 23.1887 113.002 24.225V34.028C113.002 35.0644 112.162 35.9045 111.126 35.9045H93.5894C92.553 35.9045 91.7129 35.0644 91.7129 34.028V24.225Z" fill="#000E3D"/>
<path d="M71.8789 40.6919C71.8789 39.6556 72.719 38.8154 73.7554 38.8154H111.125C112.162 38.8154 113.002 39.6556 113.002 40.6919V50.222C113.002 51.2583 112.162 52.0985 111.125 52.0985H73.7554C72.719 52.0985 71.8789 51.2583 71.8789 50.222V40.6919Z" fill="#000E3D"/>
<path d="M93.8555 7.75737C93.8555 6.721 94.6956 5.88086 95.732 5.88086H111.961C112.997 5.88086 113.837 6.721 113.837 7.75737V18.1972C113.837 19.2336 112.997 20.0737 111.961 20.0737H95.732C94.6956 20.0737 93.8555 19.2336 93.8555 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M93.8555 40.2372C93.8555 39.2009 94.6956 38.3607 95.732 38.3607H111.961C112.997 38.3607 113.837 39.2009 113.837 40.2372V50.6771C113.837 51.7134 112.997 52.5536 111.961 52.5536H95.732C94.6956 52.5536 93.8555 51.7134 93.8555 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M117.701 7.75737C117.701 6.721 118.541 5.88086 119.578 5.88086H156.948C157.984 5.88086 158.824 6.721 158.824 7.75737V18.1972C158.824 19.2336 157.984 20.0737 156.948 20.0737H119.578C118.541 20.0737 117.701 19.2336 117.701 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M93.8555 24.2249C93.8555 23.1885 94.6956 22.3484 95.732 22.3484H132.01C133.046 22.3484 133.887 23.1885 133.887 24.2249V34.0279C133.887 35.0642 133.046 35.9044 132.01 35.9044H95.732C94.6956 35.9044 93.8555 35.0642 93.8555 34.0279V24.2249Z" fill="#E5102E"/>
<path d="M137.535 24.2249C137.535 23.1885 138.375 22.3484 139.412 22.3484H156.948C157.984 22.3484 158.824 23.1885 158.824 24.2249V34.0279C158.824 35.0642 157.984 35.9044 156.948 35.9044H139.412C138.375 35.9044 137.535 35.0642 137.535 34.0279V24.2249Z" fill="#000E3D"/>
<path d="M117.701 40.6919C117.701 39.6556 118.541 38.8154 119.578 38.8154H156.948C157.984 38.8154 158.824 39.6556 158.824 40.6919V50.222C158.824 51.2583 157.984 52.0985 156.948 52.0985H119.578C118.541 52.0985 117.701 51.2583 117.701 50.222V40.6919Z" fill="#000E3D"/>
<path d="M139.678 7.75737C139.678 6.721 140.518 5.88086 141.554 5.88086H157.783C158.82 5.88086 159.66 6.721 159.66 7.75737V18.1972C159.66 19.2336 158.82 20.0737 157.783 20.0737H141.554C140.518 20.0737 139.678 19.2336 139.678 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M139.678 40.2372C139.678 39.2009 140.518 38.3607 141.554 38.3607H157.783C158.82 38.3607 159.66 39.2009 159.66 40.2372V50.6771C159.66 51.7134 158.82 52.5536 157.783 52.5536H141.554C140.518 52.5536 139.678 51.7134 139.678 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M163.523 7.75737C163.523 6.721 164.364 5.88086 165.4 5.88086H202.77C203.806 5.88086 204.646 6.721 204.646 7.75737V18.1972C204.646 19.2336 203.806 20.0737 202.77 20.0737H165.4C164.364 20.0737 163.523 19.2336 163.523 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M139.678 24.2249C139.678 23.1885 140.518 22.3484 141.554 22.3484H177.832C178.869 22.3484 179.709 23.1885 179.709 24.2249V34.0279C179.709 35.0642 178.869 35.9044 177.832 35.9044H141.554C140.518 35.9044 139.678 35.0642 139.678 34.0279V24.2249Z" fill="#E5102E"/>
<path d="M183.357 24.2249C183.357 23.1885 184.198 22.3484 185.234 22.3484H202.77C203.807 22.3484 204.647 23.1885 204.647 24.2249V34.0279C204.647 35.0642 203.807 35.9044 202.77 35.9044H185.234C184.198 35.9044 183.357 35.0642 183.357 34.0279V24.2249Z" fill="#000E3D"/>
<path d="M163.523 40.6919C163.523 39.6556 164.364 38.8154 165.4 38.8154H202.77C203.806 38.8154 204.646 39.6556 204.646 40.6919V50.222C204.646 51.2583 203.806 52.0985 202.77 52.0985H165.4C164.364 52.0985 163.523 51.2583 163.523 50.222V40.6919Z" fill="#000E3D"/>
<path d="M185.5 7.75737C185.5 6.721 186.34 5.88086 187.377 5.88086H203.605C204.642 5.88086 205.482 6.721 205.482 7.75737V18.1972C205.482 19.2336 204.642 20.0737 203.605 20.0737H187.377C186.34 20.0737 185.5 19.2336 185.5 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M185.5 40.2372C185.5 39.2009 186.34 38.3607 187.377 38.3607H203.605C204.642 38.3607 205.482 39.2009 205.482 40.2372V50.6771C205.482 51.7134 204.642 52.5536 203.605 52.5536H187.377C186.34 52.5536 185.5 51.7134 185.5 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M209.346 7.75737C209.346 6.721 210.186 5.88086 211.222 5.88086H248.592C249.628 5.88086 250.469 6.721 250.469 7.75737V18.1972C250.469 19.2336 249.628 20.0737 248.592 20.0737H211.222C210.186 20.0737 209.346 19.2336 209.346 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M185.5 24.2249C185.5 23.1885 186.34 22.3484 187.377 22.3484H223.655C224.691 22.3484 225.531 23.1885 225.531 24.2249V34.0279C225.531 35.0642 224.691 35.9044 223.655 35.9044H187.377C186.34 35.9044 185.5 35.0642 185.5 34.0279V24.2249Z" fill="#E5102E"/>
<path d="M229.18 24.2249C229.18 23.1885 230.02 22.3484 231.056 22.3484H248.592C249.629 22.3484 250.469 23.1885 250.469 24.2249V34.0279C250.469 35.0642 249.629 35.9044 248.592 35.9044H231.056C230.02 35.9044 229.18 35.0642 229.18 34.0279V24.2249Z" fill="#000E3D"/>
<path d="M209.346 40.6919C209.346 39.6556 210.186 38.8154 211.222 38.8154H248.592C249.628 38.8154 250.469 39.6556 250.469 40.6919V50.222C250.469 51.2583 249.628 52.0985 248.592 52.0985H211.222C210.186 52.0985 209.346 51.2583 209.346 50.222V40.6919Z" fill="#000E3D"/>
<path d="M231.322 7.75737C231.322 6.721 232.162 5.88086 233.199 5.88086H249.428C250.464 5.88086 251.304 6.721 251.304 7.75737V18.1972C251.304 19.2336 250.464 20.0737 249.428 20.0737H233.199C232.162 20.0737 231.322 19.2336 231.322 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M231.322 40.2372C231.322 39.2009 232.162 38.3607 233.199 38.3607H249.428C250.464 38.3607 251.304 39.2009 251.304 40.2372V50.6771C251.304 51.7134 250.464 52.5536 249.428 52.5536H233.199C232.162 52.5536 231.322 51.7134 231.322 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M255.168 7.75737C255.168 6.721 256.008 5.88086 257.044 5.88086H294.414C295.451 5.88086 296.291 6.721 296.291 7.75737V18.1972C296.291 19.2336 295.451 20.0737 294.414 20.0737H257.044C256.008 20.0737 255.168 19.2336 255.168 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M231.322 24.2249C231.322 23.1885 232.162 22.3484 233.199 22.3484H269.477C270.513 22.3484 271.353 23.1885 271.353 24.2249V34.0279C271.353 35.0642 270.513 35.9044 269.477 35.9044H233.199C232.162 35.9044 231.322 35.0642 231.322 34.0279V24.2249Z" fill="#E5102E"/>
<path d="M275.002 24.2249C275.002 23.1885 275.842 22.3484 276.878 22.3484H294.415C295.451 22.3484 296.291 23.1885 296.291 24.2249V34.0279C296.291 35.0642 295.451 35.9044 294.415 35.9044H276.878C275.842 35.9044 275.002 35.0642 275.002 34.0279V24.2249Z" fill="#000E3D"/>
<path d="M255.168 40.6919C255.168 39.6556 256.008 38.8154 257.044 38.8154H294.414C295.451 38.8154 296.291 39.6556 296.291 40.6919V50.222C296.291 51.2583 295.451 52.0985 294.414 52.0985H257.044C256.008 52.0985 255.168 51.2583 255.168 50.222V40.6919Z" fill="#000E3D"/>
<path d="M277.145 7.75737C277.145 6.721 277.985 5.88086 279.021 5.88086H295.25C296.286 5.88086 297.126 6.721 297.126 7.75737V18.1972C297.126 19.2336 296.286 20.0737 295.25 20.0737H279.021C277.985 20.0737 277.145 19.2336 277.145 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M277.145 40.2372C277.145 39.2009 277.985 38.3607 279.021 38.3607H295.25C296.286 38.3607 297.126 39.2009 297.126 40.2372V50.6771C297.126 51.7134 296.286 52.5536 295.25 52.5536H279.021C277.985 52.5536 277.145 51.7134 277.145 50.6771V40.2372Z" fill="#000E3D"/>
<path d="M300.99 7.75737C300.99 6.721 301.83 5.88086 302.867 5.88086H340.237C341.273 5.88086 342.113 6.721 342.113 7.75737V18.1972C342.113 19.2336 341.273 20.0737 340.237 20.0737H302.867C301.83 20.0737 300.99 19.2336 300.99 18.1972V7.75737Z" fill="#000E3D"/>
<path d="M277.145 24.2249C277.145 23.1885 277.985 22.3484 279.021 22.3484H315.299C316.335 22.3484 317.176 23.1885 317.176 24.2249V34.0279C317.176 35.0642 316.335 35.9044 315.299 35.9044H279.021C277.985 35.9044 277.145 35.0642 277.145 34.0279V24.2249Z" fill="#E5102E"/>
<path d="M320.824 24.2249C320.824 23.1885 321.664 22.3484 322.701 22.3484H340.237C341.273 22.3484 342.113 23.1885 342.113 24.2249V34.0279C342.113 35.0642 341.273 35.9044 340.237 35.9044H322.701C321.664 35.9044 320.824 35.0642 320.824 34.0279V24.2249Z" fill="#000E3D"/>
<path d="M300.99 40.6919C300.99 39.6556 301.83 38.8154 302.867 38.8154H340.237C341.273 38.8154 342.113 39.6556 342.113 40.6919V50.222C342.113 51.2583 341.273 52.0985 340.237 52.0985H302.867C301.83 52.0985 300.99 51.2583 300.99 50.222V40.6919Z" fill="#000E3D"/>
</g>
</svg>
`;

const MerchantProfileScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ average_rating: 0, total_reviews: 0 });

  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
        setLoading(false);
        return;
      }

      // Buscar perfil do negócio
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (businessError) {
        console.error('Erro ao buscar perfil do negócio:', businessError);
        setLoading(false);
        return;
      }

      if (businessData) {
        setBusinessProfile(businessData as BusinessProfile);
      }

      // Buscar serviços do negócio
      if (businessData) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessData.id)
          .order('created_at', { ascending: false });

        if (servicesError) {
          console.error('Erro ao buscar serviços:', servicesError);
        } else if (servicesData) {
          // Os serviços serão atualizados com ratings abaixo
          // setServices(servicesData as Service[]);
        }

        // Buscar estatísticas de avaliações do negócio
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating')
          .eq('business_id', businessData.id);

        if (!reviewsError && reviewsData) {
          const total = reviewsData.length;
          const average =
            total > 0
              ? reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / total
              : 0;
          setReviewStats({
            average_rating: average,
            total_reviews: total,
          });
        }

        // Buscar avaliações por serviço para calcular ratings individuais
        if (servicesData) {
          const servicesWithRatings = await Promise.all(
            (servicesData as Service[]).map(async (service) => {
              const { data: serviceReviews } = await supabase
                .from('reviews')
                .select('rating')
                .eq('service_id', service.id);

              const rating =
                serviceReviews && serviceReviews.length > 0
                  ? serviceReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / serviceReviews.length
                  : undefined;
              const reviewCount = serviceReviews?.length || undefined;

              return {
                ...service,
                rating,
                review_count: reviewCount,
              };
            })
          );
          setServices(servicesWithRatings);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWorkDays = (workDays: Record<string, { start: string; end: string }> | null) => {
    if (!workDays) return 'Não informado';

    const days = Object.keys(workDays);
    if (days.length === 0) return 'Não informado';

    const dayNames: Record<string, string> = {
      monday: 'Seg',
      tuesday: 'Ter',
      wednesday: 'Qua',
      thursday: 'Qui',
      friday: 'Sex',
      saturday: 'Sáb',
      sunday: 'Dom',
    };

    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const firstData = workDays[firstDay];
    const lastData = workDays[lastDay];

    const formatTime = (time: string) => {
      const [hours] = time.split(':');
      return `${hours}h`;
    };

    if (days.length === 1) {
      return `${dayNames[firstDay] || firstDay} - ${formatTime(firstData.start)} às ${formatTime(firstData.end)}`;
    }

    return `${dayNames[firstDay] || firstDay} à ${dayNames[lastDay] || lastDay} - ${formatTime(firstData.start)} às ${formatTime(lastData.end)}`;
  };

  const getPriceRange = (services: Service[]) => {
    if (services.length === 0) return '$$$$$';
    const prices = services.map((s) => s.price).filter((p) => p > 0);
    if (prices.length === 0) return '$$$$$';
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    if (avg < 30) return '$$$$$';
    if (avg < 50) return '$$$$$';
    if (avg < 100) return '$$$$$';
    return '$$$$$';
  };

  const renderServiceCard = ({ item }: { item: Service }) => {
    let imagesArray: string[] = [];
    if (item.photos) {
      if (typeof item.photos === 'string') {
        try {
          imagesArray = JSON.parse(item.photos);
        } catch {
          imagesArray = [item.photos];
        }
      } else if (Array.isArray(item.photos)) {
        imagesArray = item.photos;
      }
    }
    const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => router.push(`/(merchant)/services/edit/${item.id}`)}
      >
        <Image
          source={firstImage ? { uri: firstImage } : undefined}
          style={[styles.serviceImage, !firstImage && styles.placeholderImage]}
          resizeMode="cover"
        />

        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.serviceDetailsRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingValue}>{item.rating?.toFixed(1) || '4.8'}</Text>
              <IconRatingStar size={14} color="#FFCE31" />
              <Text style={styles.reviewCount}>({item.review_count || 25})</Text>
            </View>
          </View>

          <Text style={styles.servicePrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Perfil do negócio não encontrado</Text>
      </View>
    );
  }

  const paymentMethods = businessProfile.accepted_payment_methods || {};
  const priceRange = getPriceRange(services);

  return (
    <View style={styles.container}>
      <MerchantTopBar />
      {/* Background com bricks pattern */}
      <View style={styles.backgroundPattern} pointerEvents="none">
        <SvgXml xml={backgroundSvg} style={styles.backgroundSvg} preserveAspectRatio="xMidYMid slice" />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <View style={styles.heroImageContainer}>
            {businessProfile.logo_url ? (
              <Image
                source={{ uri: businessProfile.logo_url }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.heroImage, styles.placeholderImage]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,14,61,0.5)']}
              style={styles.heroGradient}
            />
          </View>

          {/* Profile Avatar e Info */}
          <View style={styles.profileAvatarContainer}>
            <View style={styles.avatarContainer}>
              {businessProfile.logo_url ? (
                <Image
                  source={{ uri: businessProfile.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.businessName}>{businessProfile.business_name}</Text>
              <Text style={styles.businessDescription}>
                {businessProfile.description || 'Serviços profissionais'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ratings Card */}
        <View style={styles.ratingsCard}>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingValueContainer}>
              <Text style={styles.ratingText}>
                {reviewStats.total_reviews === 0
                  ? 'Sem avaliações'
                  : `${reviewStats.average_rating.toFixed(1)}`}
              </Text>
            </View>
            <Text style={styles.ratingCount}>({reviewStats.total_reviews})</Text>
          </View>
          <View style={styles.ratingContainer}>
            <Text style={styles.priceRangeLabel}>Preço médio</Text>
            <Text style={styles.priceRangeValue}>
              {priceRange.slice(0, 3)}
              <Text style={styles.priceRangeInactive}>{priceRange.slice(3)}</Text>
            </Text>
          </View>
        </View>

        {/* Payment Methods Card */}
        <View style={styles.paymentMethodsCard}>
          <Text style={styles.paymentMethodsTitle}>Pagamentos aceitos</Text>
          <View style={styles.paymentMethodsRow}>
            {paymentMethods.pix && (
              <View style={styles.paymentMethodItem}>
                <IconPix width={24} height={24} />
                <Text style={styles.paymentMethodText}>PIX</Text>
              </View>
            )}
            {paymentMethods.card && (
              <View style={styles.paymentMethodItem}>
                <IconCreditCard width={24} height={24} color="#000E3D" />
                <Text style={styles.paymentMethodText}>Cartão</Text>
              </View>
            )}
            {paymentMethods.cash && (
              <View style={styles.paymentMethodItem}>
                <IconCash width={24} height={24} color="#000E3D" />
                <Text style={styles.paymentMethodText}>Dinheiro</Text>
              </View>
            )}
          </View>
        </View>

        {/* Operating Hours Card */}
        <View style={styles.operatingHoursCard}>
          <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
          <Text style={styles.operatingHoursText}>
            {formatWorkDays(businessProfile.work_days)}
          </Text>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.editProfileButton}
          activeOpacity={0.8}
          onPress={() => router.push('/(merchant)/profile/edit')}
        >
          <Text style={styles.editProfileButtonText}>Editar Perfil</Text>
        </TouchableOpacity>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.servicesTitle}>Serviços</Text>
          {services.length > 0 ? (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.servicesList}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço cadastrado</Text>
          )}

          {/* Add Service Button */}
          <TouchableOpacity
            style={styles.addServiceButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(merchant)/services/create')}
          >
            <Text style={styles.addServiceButtonText}>Cadastrar novo serviço</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default MerchantProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  backgroundPattern: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 380,
    opacity: 0.25,
    zIndex: 0,
  },
  backgroundSvg: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroContainer: {
    marginTop: 24,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  heroImageContainer: {
    height: 122,
    borderRadius: 8,
    marginBottom: -80,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  profileAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    height: 88,
    marginTop: -80,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  businessDescription: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#FEFEFE',
  },
  ratingsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ratingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  priceRangeLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  priceRangeValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  priceRangeInactive: {
    color: '#DBDBDB',
  },
  paymentMethodsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentMethodsTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    flex: 1,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  operatingHoursCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  operatingHoursTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  operatingHoursText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  editProfileButton: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  editProfileButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  servicesSection: {
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 16,
  },
  servicesTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  servicesList: {
    gap: 16,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#474747',
    overflow: 'hidden',
    height: 104,
  },
  serviceImage: {
    width: 85,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    marginBottom: 4,
  },
  serviceDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBadge: {
    fontSize: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
    marginLeft: 2,
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  addServiceButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addServiceButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  emptyServicesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#E5102E',
    textAlign: 'center',
    marginTop: 24,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
});
