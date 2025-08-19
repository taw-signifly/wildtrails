# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WildTrails is a Next.js 15 application built with React 19, TypeScript, and TailwindCSS v4. This is a fresh project bootstrapped with `create-next-app` using the App Router architecture.

## Development Commands

- `npm run dev` - Start development server with Turbopack (opens at http://localhost:3000)
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint with Next.js configuration

## Architecture & Structure

**Framework**: Next.js 15 with App Router
- Uses the `/src/app` directory structure for routing
- TypeScript with strict mode enabled
- TailwindCSS v4 for styling with PostCSS
- Geist font family (sans and mono) preloaded from Google Fonts

**Key Configuration**:
- TypeScript path mapping: `@/*` maps to `./src/*`
- ESLint extends `next/core-web-vitals` and `next/typescript`
- Uses Turbopack for fast development builds

**Current Structure**:
- `src/app/layout.tsx` - Root layout with font configuration and metadata
- `src/app/page.tsx` - Home page component
- `src/app/globals.css` - Global styles
- Standard Next.js public assets directory

## Development Notes

The application uses Next.js App Router with React Server Components by default. The codebase follows standard Next.js conventions and uses the latest stable versions of React and Next.js.