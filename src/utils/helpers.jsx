import React from 'react';

// Persian translations for FIFA World Cup teams
export const TEAM_NAMES_FA = {
  'Germany': 'آلمان',
  'Curaçao': 'کوراسائو',
  'Haiti': 'هائیتی',
  'Scotland': 'اسکاتلند',
  'Australia': 'استرالیا',
  'Turkey': 'ترکیه',
  'Türkiye': 'ترکیه',
  'Netherlands': 'هلند',
  'Japan': 'ژاپن',
  'Ivory Coast': 'ساحل عاج',
  'Ecuador': 'اکوادور',
  'Iran': 'ایران',
  'Portugal': 'پرتغال',
  'Spain': 'اسپانیا',
  'Argentina': 'آرژانتین',
  'Brazil': 'برزیل',
  'France': 'فرانسه',
  'England': 'انگلستان',
  'Italy': 'ایتالیا',
  'Belgium': 'بلژیک',
  'Croatia': 'کرواسی',
  'Uruguay': 'اروگوئه',
  'Colombia': 'کلمبیا',
  'Morocco': 'مراکش',
  'Senegal': 'سنگال',
  'USA': 'آمریکا',
  'United States': 'آمریکا',
  'Mexico': 'مکزیک',
  'Canada': 'کانادا',
  'Saudi Arabia': 'عربستان سعودی',
  'South Korea': 'کره جنوبی',
  'Qatar': 'قطر',
  'Switzerland': 'سوئیس',
  'Denmark': 'دانمارک',
  'Tunisia': 'تونس',
  'Poland': 'لهستان',
  'Wales': 'ولز',
  'Ghana': 'غنا',
  'Cameroon': 'کامرون',
  'Serbia': 'صربستان',
  'Costa Rica': 'کاستاریکا',
  'Peru': 'پرو',
  'Ukraine': 'اوکراین',
  'Sweden': 'سوئد',
  'Austria': 'اتریش',
  'Egypt': 'مصر',
  'Algeria': 'الجزایر',
  'Nigeria': 'نیجریه',
  'Chile': 'شیلی',
  'Paraguay': 'پاراگوئه'
};

export const getPersianTeamName = (name) => {
  return TEAM_NAMES_FA[name] || name;
};

// Formatting helpers for match time & date
export const formatMatchTime = (utcDateString) => {
  try {
    const date = new Date(utcDateString);
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '';
  }
};

export const formatMatchDate = (utcDateString) => {
  try {
    const date = new Date(utcDateString);
    return date.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric', weekday: 'long' });
  } catch (e) {
    return '';
  }
};

// Crest rendering helper supporting SVG URLs and emoji fallbacks
export const renderCrest = (crest, name, className = '') => {
  if (!crest) return null;
  if (typeof crest === 'string' && crest.startsWith('http')) {
    return (
      <img
        src={crest}
        alt={name}
        className={className}
        style={{
          width: '24px',
          height: '24px',
          objectFit: 'contain',
          borderRadius: '4px',
          display: 'inline-block',
          verticalAlign: 'middle'
        }}
      />
    );
  }
  return <span className={className}>{crest}</span>;
};
