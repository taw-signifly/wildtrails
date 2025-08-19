Please analyze and fix the Github issue: $ARGUMENTS.

## Agent Usage

**Always use specialized agents when applicable:**

- **react-nextjs-expert**: For Next.js development, App Router, SSR/SSG, server components, and optimization
- **debug-specialist**: For errors, test failures, unexpected behavior, build issues, or technical problems
- **sql-pro**: For complex SQL queries, database optimization, schema design and general database integration
- **code-reviewer**: For comprehensive code quality assessment after completing coding tasks

Use the Task tool to launch these agents proactively when their expertise matches the work being done.

Follow these steps:

# PLAN

1. Use 'gh issue view' to get the issue details
2. Understand the problem described in the issue
3. Ask clarifying questions if necessary
4. Understand the prior art for this issue

- Search the scratchpads for previous thoughts related to the issue (they are placed in .claude/scratchpads/)
- Search PRs to see if you can find history on this issue
- Search the codebase for relevant files

5. Think harder about how to break the issue down into a series of small, manageable tasks

- The coding style should follow modern Next.js 15 patterns:
- Server Components used by default
- Client components only when interactivity is needed
- Proper use of `'use client'` directive (minimal usage)
- Server Actions for mutations instead of API routes when possible
- Proper data fetching patterns (parallel, not waterfall)
- Typesafe

6. Document your plan in a new scratchpad (save it in ./claude/scrstchpads/)

- Include the issue name in the filename
- Include a link to the issue in the scratchpad

# CREATE

- Create a new branch for the issue
- Solve the issue in small, manageable steps, according to your plan
- Commit your changes after each step

# TEST

- Write Jest tests to describe the expected behavior of your code
- Run the full test suite to ensure you haven't broken anything
- If any tests are failing, fix them
- Ensure that all tests are passing
- Run a build to make sure there are no errors before moving on to the next step

# DEPLOY

- Open a PR and request a review

Remember to use the GitHub CLI (`gh`) for all Github-related tasks

