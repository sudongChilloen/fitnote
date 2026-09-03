

import { Prisma } from "@/generated/prisma/client";
import {
  Difficulty,
  ExerciseMovementType,
  WorkoutBodyPart,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * 목록/상세가 동일한 형태를 반환하도록 공통 include 와 매퍼를 사용한다.
 * 한쪽만 필드가 바뀌어 응답이 어긋나는 것을 방지한다.
 */
const exerciseInclude = {
  equipment: {
    where: {
      equipment: {
        isActive: true,
      },
    },

    orderBy: [
      {
        isPrimary: "desc",
      },
      {
        equipment: {
          name: "asc",
        },
      },
    ],

    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
        },
      },
    },
  },

  alternativesFrom: {
    where: {
      alternativeExercise: {
        isActive: true,
      },
    },

    orderBy: [
      {
        priority: "asc",
      },
    ],

    include: {
      alternativeExercise: {
        select: {
          id: true,
          name: true,
          bodyPart: true,
          targetMuscle: true,
          movementType: true,
          difficulty: true,
          thumbnailUrl: true,

          equipment: {
            where: {
              equipment: {
                isActive: true,
              },
            },

            orderBy: [
              {
                isPrimary: "desc",
              },
            ],

            include: {
              equipment: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ExerciseInclude;

type ExerciseWithRelations = Prisma.ExerciseGetPayload<{
  include: typeof exerciseInclude;
}>;

function toExerciseDto(exercise: ExerciseWithRelations) {
  return {
    id: exercise.id,
    name: exercise.name,

    bodyPart: exercise.bodyPart,
    targetMuscle: exercise.targetMuscle,

    movementType: exercise.movementType,
    difficulty: exercise.difficulty,

    description: exercise.description,
    instruction: exercise.instruction,
    breathing: exercise.breathing,
    caution: exercise.caution,

    videoUrl: exercise.videoUrl,
    thumbnailUrl: exercise.thumbnailUrl,

    equipment: exercise.equipment.map((item) => ({
      id: item.equipment.id,
      name: item.equipment.name,
      category: item.equipment.category,
      imageUrl: item.equipment.imageUrl,
      isPrimary: item.isPrimary,
    })),

    alternatives: exercise.alternativesFrom.map((item) => ({
      id: item.alternativeExercise.id,
      name: item.alternativeExercise.name,

      bodyPart: item.alternativeExercise.bodyPart,
      targetMuscle: item.alternativeExercise.targetMuscle,

      movementType: item.alternativeExercise.movementType,
      difficulty: item.alternativeExercise.difficulty,

      thumbnailUrl: item.alternativeExercise.thumbnailUrl,

      // 대체 운동에 필요한 장비. "기구가 없어요" 흐름에서
      // 지금 쓸 수 있는 운동인지 바로 판단할 수 있도록 함께 내려준다.
      equipment: item.alternativeExercise.equipment.map((equipmentItem) => ({
        id: equipmentItem.equipment.id,
        name: equipmentItem.equipment.name,
        category: equipmentItem.equipment.category,
        isPrimary: equipmentItem.isPrimary,
      })),

      type: item.type,
      priority: item.priority,
      reason: item.reason,
    })),
  };
}

export interface GetExercisesParams {
  search?: string;
  bodyPart?: WorkoutBodyPart;
  difficulty?: Difficulty;
  movementType?: ExerciseMovementType;
  equipmentId?: string;

  page?: number;
  limit?: number;
}

export async function getExercises({
  search,
  bodyPart,
  difficulty,
  movementType,
  equipmentId,
  page = 1,
  limit = 20,
}: GetExercisesParams) {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(Math.max(1, limit), 100);

  const skip = (normalizedPage - 1) * normalizedLimit;

  const where: Prisma.ExerciseWhereInput = {
    isActive: true,

    ...(search
      ? {
          name: {
            contains: search.trim(),
            mode: "insensitive",
          },
        }
      : {}),

    ...(bodyPart
      ? {
          bodyPart,
        }
      : {}),

    ...(difficulty
      ? {
          difficulty,
        }
      : {}),

    ...(movementType
      ? {
          movementType,
        }
      : {}),

    ...(equipmentId
      ? {
          equipment: {
            some: {
              equipmentId,
            },
          },
        }
      : {}),
  };

  const [exercises, total] = await Promise.all([
    prisma.exercise.findMany({
      where,

      skip,
      take: normalizedLimit,

      orderBy: [
        {
          name: "asc",
        },
      ],

      include: exerciseInclude,
    }),

    prisma.exercise.count({
      where,
    }),
  ]);

  const totalPages = Math.ceil(total / normalizedLimit);

  return {
    data: exercises.map(toExerciseDto),

    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPreviousPage: normalizedPage > 1,
    },
  };
}
/**
 * 운동 상세 조회.
 * 존재하지 않거나 비활성화된 운동이면 null 을 반환한다.
 */
export async function getExerciseById(id: string) {
  const exercise = await prisma.exercise.findFirst({
    where: {
      id,
      isActive: true,
    },

    include: exerciseInclude,
  });

  if (!exercise) {
    return null;
  }

  return toExerciseDto(exercise);
}
