# CLAUDE.md

# Project: Vector

## Overview

Vector is an AI-powered project execution intelligence platform that transforms high-level goals into structured, adaptive dynamic execution roadmaps.

Unlike traditional project management tools that require users to manually create tasks, Vector understands natural language goals, reasons about execution strategy, identifies dependencies, generates milestones, and continuously adapts project plans as requirements evolve.

Vector is not a task manager.

Vector is an AI execution strategist.

---

# Product Mission

Turn ideas into executable plans.

Every feature should help users answer:

- What should I build?
- What should I do next?
- What dependencies exist?
- What risks should I consider?
- How should my plan change?

---

# Target Users

## Primary Users

### Students
People working on academic projects, hackathons, and personal ideas.

### Startup Founders
People converting ideas into MVPs.

### Developers
People who need structured technical execution plans.

### Freelancers
People managing complex client projects.

### Small Teams
Teams that need lightweight execution intelligence.

---

# Core Problem

Most project management tools assume users already know:

- What tasks need to be created
- What order tasks should happen in
- Which tasks depend on others
- How changing requirements affect timelines

The hardest part of execution is not managing tasks.

The hardest part is deciding the correct path.

Vector solves:

"What should I do next?"

---

# Core User Flow

This is the main MVP experience.

```
User enters project goal

↓

AI Discovery Conversation

↓

Claude understands intent

↓

Extract requirements and constraints

↓

Generate workstreams

↓

Generate tasks

↓

Identify dependencies

↓

Generate milestones

↓

Render interactive roadmap

↓

User modifies requirements

↓

Claude adapts roadmap

↓

Save project history
```

---

# MVP Scope

## MUST HAVE

### 1. Goal Input

Users describe their objective using natural language.

Example:

"I want to build an AI fitness application in 3 months."

Output:

Structured project goal.

---

### 2. AI Discovery

Claude asks relevant questions before planning.

Questions may include:

- Timeline
- Team size
- Budget
- Technical requirements
- Target audience
- Constraints

Claude should not make assumptions when information is missing.

---

### 3. Goal Understanding

Claude converts:

Natural language goal

into:

- Objectives
- Requirements
- Constraints
- Expected outcomes

---

### 4. Task Generation

Claude creates:

- Workstreams
- Tasks
- Subtasks
- Priorities

---

### 5. Dependency Engine

Vector identifies:

- Task relationships
- Blocking tasks
- Execution order
- Parallel activities

All dependencies must form a valid Directed Acyclic Graph (DAG).

Never create circular dependencies.

---

### 6. Interactive Roadmap

Display:

- Milestones
- Tasks
- Dependencies
- Timeline
- Progress

Use React Flow for visualization.

---

### 7. Project Memory

Store:

- Goals
- Decisions
- Requirements
- Changes
- Completed tasks

Future recommendations should use previous project context.

---

# SHOULD HAVE

## Dynamic Replanning

When users change:

- Deadline
- Scope
- Team
- Requirements

Claude should update only affected sections.

Completed work should always be preserved.

---

## AI Recommendations

Provide:

- Next best action
- Risk warnings
- Optimization suggestions
- Decision support

Every recommendation must include reasoning.

Example:

"Move authentication before payments because payment systems require user identity management."

---

## Progress Tracking

Track:

- Completed tasks
- Current milestone
- Delays
- Remaining work

---

# COULD HAVE

## Integrations

- GitHub
- Google Calendar
- Notion
- Jira
- Slack

---

## Advanced Features

- Voice-based planning
- Team collaboration
- Predictive completion dates
- Local AI deployment
- Multi-agent workflows

---

# Application Structure

Build the scaffold before features.

---

# Routes

```
/

Landing page


/dashboard

Project overview


/projects/new

Goal creation flow


/projects/[id]

Project workspace


/projects/[id]/roadmap

Interactive roadmap


/projects/[id]/ai

AI strategist interface


/settings

User settings
```

---

# Main Screens

## 1. Goal Creation Screen

Purpose:

Capture user's idea.

Components:

- Goal input
- AI conversation
- Requirement extraction
- Project setup

---

## 2. Dashboard

Purpose:

Project overview.

Shows:

- Goal summary
- Current status
- Milestones
- Risks
- Recommended next action

---

## 3. AI Strategist

Purpose:

Claude interaction interface.

Claude can:

- Ask questions
- Explain decisions
- Recommend actions
- Detect problems

---

## 4. Roadmap Screen

Purpose:

Visual execution planning.

Shows:

- Workstreams
- Tasks
- Dependencies
- Timeline

---

# Data Models

Define data structures before APIs.

---

## Project

```ts
{
 id: string;
 title: string;
 goal: string;
 description: string;
 status: string;
 timeline: string;
 createdAt: Date;
}
```

---

## Task

```ts
{
 id: string;
 projectId: string;
 title: string;
 description: string;
 priority: string;
 status: string;
 estimatedTime: number;
 dependencies: string[];
}
```

---

## Workstream

```ts
{
 id: string;
 name: string;
 description: string;
 tasks: Task[];
}
```

---

## Milestone

```ts
{
 id: string;
 title: string;
 deadline: Date;
 completed: boolean;
}
```

---

## Recommendation

```ts
{
 id: string;
 message: string;
 reasoning: string;
 impact: string;
}
```

---

# AI Responsibilities

Claude is responsible for:

## Understanding

Interpret user goals.

---

## Planning

Generate execution strategies.

---

## Reasoning

Understand relationships between tasks.

---

## Dependency Detection

Identify:

- Required order
- Blockers
- Critical paths

---

## Adaptation

Update roadmap when conditions change.

---

## Explanation

Always explain why decisions are made.

Do not only provide outputs.

---

# AI Rules

Claude should:

- Ask clarifying questions when information is missing.
- Avoid hallucinating project facts.
- Prioritize logical execution order.
- Preserve completed work.
- Explain dependencies.

Claude should NOT:

- Generate random tasks.
- Create unrealistic timelines.
- Assume missing requirements.

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Flow

---

## Backend

- FastAPI
- Python

---

## AI

- Claude API

Responsibilities:

- Goal reasoning
- Planning
- Recommendations
- Adaptation

---

## Database

- Supabase PostgreSQL

Stores:

- Users
- Projects
- Tasks
- Dependencies
- Milestones
- History

---

## Authentication

- Supabase Auth

---

## Deployment

Frontend:
Vercel

Backend:
Render

---

# Folder Structure

```
/frontend

/app
/components
/hooks
/utils


/backend

/routes
/services
/models
/ai
/database


/docs

/assets
```

---

# Coding Standards

Always:

- Use TypeScript strict mode.
- Use functional React components.
- Build reusable components.
- Keep files small.
- Keep business logic in backend.
- Write modular code.

Never:

- Use "any".
- Hardcode API keys.
- Duplicate logic.
- Expose secrets.
- Modify database schema without documentation.

---

# Git Workflow

Create feature branches.

Examples:

```
feature/auth

feature/roadmap

feature/claude

feature/dependencies

feature/dashboard
```

Never commit directly to main.

---

# Commit Format

```
feat:

fix:

refactor:

docs:

test:

style:
```

Examples:

```
feat: add Claude roadmap generator

fix: dependency graph rendering

docs: update API documentation
```

---

# Testing

Every feature should include testing.

Test:

## AI

- Goal understanding
- Task generation
- Dependency generation
- Recommendations

## Backend

- APIs
- Database operations

## Frontend

- Components
- Roadmap rendering
- User interactions

---

# UI Principles

Design should feel like:

- Linear
- Notion
- GitHub Projects

Rules:

- Minimal design
- White space first
- Professional interface
- No unnecessary animations
- Clear hierarchy

---

# Demo Requirement

The final demo should show:

User:

"I want to launch a startup."

↓

Claude asks questions.

↓

Vector creates:

- Workstreams
- Tasks
- Dependencies
- Milestones
- Timeline

↓

User:

"We only have 2 months."

↓

Vector updates the roadmap.

---

# Success Criteria

A user should be able to enter one sentence describing a goal and receive an actionable dependency-aware roadmap within 30 seconds.

If requirements change, Vector should adapt while maintaining project context.

---

# Final Rule

Every feature must support one mission:

## Turn ideas into executable plans.
```

This version is optimized for **Claude Code scaffolding** because it follows the workshop principle:

**Structure → Routes → Data → Core Flow → Features**

instead of jumping directly into implementation.