import { NextRequest, NextResponse } from "next/server";



import {
  getExercises,
  type GetExercisesParams,
} from "@/server/exercises/exercise.service";
import { Difficulty, ExerciseMovementType, WorkoutBodyPart } from "@/generated/prisma/enums";

function isEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string,
): value is T[keyof T] {
  return Object.values(enumObject).includes(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const search = searchParams.get("search") ?? undefined;

    const bodyPartParam = searchParams.get("bodyPart");
    const difficultyParam = searchParams.get("difficulty");
    const movementTypeParam = searchParams.get("movementType");

    const equipmentId =
      searchParams.get("equipmentId") ?? undefined;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // ----------------------------------------------------------
    // page
    // ----------------------------------------------------------

    const page = pageParam
      ? Number.parseInt(pageParam, 10)
      : 1;

    const limit = limitParam
      ? Number.parseInt(limitParam, 10)
      : 20;

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "page must be a positive integer",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "limit must be between 1 and 100",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // bodyPart
    // ----------------------------------------------------------

    let bodyPart: WorkoutBodyPart | undefined;

    if (bodyPartParam) {
      if (
        !isEnumValue(
          WorkoutBodyPart,
          bodyPartParam,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid bodyPart: ${bodyPartParam}`,
          },
          {
            status: 400,
          },
        );
      }

      bodyPart = bodyPartParam;
    }

    // ----------------------------------------------------------
    // difficulty
    // ----------------------------------------------------------

    let difficulty: Difficulty | undefined;

    if (difficultyParam) {
      if (
        !isEnumValue(
          Difficulty,
          difficultyParam,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid difficulty: ${difficultyParam}`,
          },
          {
            status: 400,
          },
        );
      }

      difficulty = difficultyParam;
    }

    // ----------------------------------------------------------
    // movementType
    // ----------------------------------------------------------

    let movementType:
      | ExerciseMovementType
      | undefined;

    if (movementTypeParam) {
      if (
        !isEnumValue(
          ExerciseMovementType,
          movementTypeParam,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid movementType: ${movementTypeParam}`,
          },
          {
            status: 400,
          },
        );
      }

      movementType = movementTypeParam;
    }

    // ----------------------------------------------------------
    // Service params
    // ----------------------------------------------------------

    const params: GetExercisesParams = {
      search,
      bodyPart,
      difficulty,
      movementType,
      equipmentId,
      page,
      limit,
    };

    const result = await getExercises(params);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "GET /api/exercises error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch exercises",
      },
      {
        status: 500,
      },
    );
  }
}