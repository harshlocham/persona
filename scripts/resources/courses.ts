import {
  resourceRecordSchema,
  type PipelinePersonaId,
  type ResourceDifficulty,
  type ResourceRecordInput,
} from "../shared/index.js";

/**
 * A curated, persona-owned course. Courses are stable, first-class offerings
 * published on the personas' own course platforms (chaicode.com,
 * piyushgarg.dev, and Udemy via hitesh.ai/udemy-* redirects). They are seeded
 * here rather than scraped so recommendations always use exact titles and URLs.
 */
interface CuratedCourse {
  readonly slug: string;
  readonly title: string;
  readonly url: string;
  readonly topics: readonly string[];
  readonly difficulty: ResourceDifficulty;
  readonly summary: string;
}

const HITESH_COURSES: readonly CuratedCourse[] = [
  {
    slug: "web-development",
    title: "Complete web development course",
    url: "https://hitesh.ai/udemy",
    topics: ["frontend", "backend", "javascript", "react"],
    difficulty: "beginner",
    summary:
      "End-to-end web development from scratch — frontend, backend, and databases with real projects.",
  },
  {
    slug: "devops",
    title: "Docker and Kubernetes for beginners | DevOps journey",
    url: "https://hitesh.ai/udemy-devops",
    topics: ["devops"],
    difficulty: "beginner",
    summary:
      "A beginner-friendly DevOps journey covering Docker and Kubernetes for containerizing and orchestrating apps.",
  },
  {
    slug: "python",
    title: "The Ultimate Python Bootcamp: Learn by Building 50 Projects",
    url: "https://hitesh.ai/udemy-py",
    topics: ["python"],
    difficulty: "beginner",
    summary:
      "Learn Python by building 50 hands-on projects, from fundamentals to practical applications.",
  },
  {
    slug: "nodejs",
    title: "Node.js - Beginner to Advance course with projects",
    url: "https://hitesh.ai/udemy-nodejs",
    topics: ["backend", "javascript"],
    difficulty: "intermediate",
    summary:
      "Node.js from beginner to advanced with real projects — Express, databases, and deployment.",
  },
  {
    slug: "ai",
    title: "Full stack generative and Agentic AI with python",
    url: "https://hitesh.ai/udemy-ai",
    topics: ["ai", "python"],
    difficulty: "advanced",
    summary:
      "Build full stack generative and agentic AI applications with Python — RAG, agents, and deployment.",
  },
  {
    slug: "nextjs",
    title: "Complete React and NextJS course with AI powered Projects",
    url: "https://hitesh.ai/udemy-nextjs",
    topics: ["react", "frontend", "ai"],
    difficulty: "intermediate",
    summary:
      "Master React and Next.js by building AI-powered projects end to end.",
  },
  {
    slug: "dsa-py",
    title: "Data structures and Algorithm (DSA) for Tech Interviews",
    url: "https://hitesh.ai/udemy-dsa-py",
    topics: ["dsa", "career"],
    difficulty: "intermediate",
    summary:
      "Data structures and algorithms preparation focused on cracking technical interviews.",
  },
  {
    slug: "chaicode",
    title: "Chai aur Code — Cohort courses",
    url: "https://chaicode.com",
    topics: ["frontend", "backend", "devops", "ai"],
    difficulty: "intermediate",
    summary:
      "Live cohort-based courses on web development, DevOps, and GenAI on the Chai aur Code platform.",
  },
];

const PIYUSH_COURSES: readonly CuratedCourse[] = [
  {
    slug: "docker",
    title: "Docker — Containerisation for Modern Development",
    url: "https://pro.piyushgarg.dev",
    topics: ["devops"],
    difficulty: "intermediate",
    summary:
      "Containerisation for modern development — CLI, custom images, networking, volumes, Compose, and orchestration on AWS ECS/ECR.",
  },
  {
    slug: "genai",
    title: "Full Stack Generative & Agentic AI with Python",
    url: "https://www.piyushgarg.dev/courses",
    topics: ["ai", "python"],
    difficulty: "advanced",
    summary:
      "Hands-on modern AI — tokenization, agents, RAG, vector DBs, and deploying scalable AI apps.",
  },
  {
    slug: "nodejs",
    title: "Node.js — Beginner to Advance",
    url: "https://www.piyushgarg.dev/courses",
    topics: ["backend", "javascript"],
    difficulty: "intermediate",
    summary:
      "Node.js from scratch to advanced — ORM, SQL, NoSQL, Express, MongoDB aggregation, Postman testing, and deployment.",
  },
  {
    slug: "dsa-java",
    title: "Data Structures & Algorithms with Java",
    url: "https://www.piyushgarg.dev/courses",
    topics: ["dsa", "java", "career"],
    difficulty: "intermediate",
    summary:
      "Master Java and DSA — OOP, linear and non-linear data structures, design patterns, and Big-O analysis.",
  },
];

const CURATED_COURSES: Record<PipelinePersonaId, readonly CuratedCourse[]> = {
  hitesh: HITESH_COURSES,
  piyush: PIYUSH_COURSES,
};

/**
 * Builds curated course resource records for a persona.
 *
 * @param personaId - Target persona identifier
 */
export function buildCourseRecords(
  personaId: PipelinePersonaId,
): ResourceRecordInput[] {
  const createdAt = new Date().toISOString();

  return CURATED_COURSES[personaId].map((course) =>
    resourceRecordSchema.parse({
      id: `resource-${personaId}-course-${course.slug}`,
      personaId,
      title: course.title,
      type: "course",
      url: course.url,
      topics: [...course.topics],
      difficulty: course.difficulty,
      summary: course.summary,
      recommendedPrerequisites: [],
      recommendedNext: [],
      sourceType: "website",
      createdAt,
    }),
  );
}
