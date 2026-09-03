-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('CENTER_ADMIN', 'TRAINER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED', 'LEFT');

-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PTProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PTContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PTSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "WorkoutRecordType" AS ENUM ('PERSONAL', 'PT');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DietMealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('JOURNAL_CREATED', 'PT_SESSION_REMINDER', 'PT_SESSION_CHANGED', 'PT_CONTRACT_EXPIRING', 'GENERAL');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('WEIGHT', 'BODY_FAT', 'MUSCLE_MASS', 'WORKOUT_FREQUENCY', 'EXERCISE_PR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('FREE_WEIGHT', 'MACHINE', 'CABLE', 'CARDIO', 'BODYWEIGHT', 'BAND', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkoutBodyPart" AS ENUM ('CHEST', 'BACK', 'SHOULDER', 'ARM', 'LEG', 'GLUTE', 'ABS', 'FULL_BODY', 'CARDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "ExerciseMovementType" AS ENUM ('PUSH', 'PULL', 'SQUAT', 'HINGE', 'LUNGE', 'CARRY', 'ROTATION', 'ISOLATION', 'CARDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "AlternativeType" AS ENUM ('SAME_MUSCLE', 'SAME_MOVEMENT', 'EQUIPMENT_ALTERNATIVE', 'DIFFICULTY_ALTERNATIVE');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "profileImageUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "status" "CenterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterMembership" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedTrainerMembershipId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "CenterMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterInvitation" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "email" TEXT,
    "code" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "heightCm" DECIMAL(65,30),
    "fitnessLevel" TEXT,
    "primaryGoal" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "bio" TEXT,
    "specialty" TEXT,
    "careerYears" INTEGER,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEquipment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "customName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymEquipment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyPart" "WorkoutBodyPart" NOT NULL,
    "targetMuscle" TEXT,
    "movementType" "ExerciseMovementType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "description" TEXT,
    "instruction" TEXT,
    "breathing" TEXT,
    "caution" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseEquipment" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExerciseEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutAlternative" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "alternativeExerciseId" TEXT NOT NULL,
    "type" "AlternativeType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "WorkoutAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoutineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByTrainerMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineExercise" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "targetSets" INTEGER,
    "targetReps" INTEGER,
    "targetWeight" DECIMAL(65,30),
    "restSeconds" INTEGER,
    "note" TEXT,

    CONSTRAINT "RoutineExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "ptSessionId" TEXT,
    "recordType" "WorkoutRecordType" NOT NULL DEFAULT 'PERSONAL',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "totalVolume" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" DECIMAL(65,30),
    "reps" INTEGER,
    "restSeconds" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "rpe" DECIMAL(65,30),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTProduct" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "durationDays" INTEGER,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "status" "PTProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerPTPrice" (
    "id" TEXT NOT NULL,
    "trainerMembershipId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerPTPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTContract" (
    "id" TEXT NOT NULL,
    "memberMembershipId" TEXT NOT NULL,
    "trainerMembershipId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(65,30) NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" "PTContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTSession" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "memberMembershipId" TEXT NOT NULL,
    "trainerMembershipId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "PTSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "memo" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" "DietMealType" NOT NULL,
    "foodName" TEXT,
    "amount" TEXT,
    "calories" DECIMAL(65,30),
    "carbohydrate" DECIMAL(65,30),
    "protein" DECIMAL(65,30),
    "fat" DECIMAL(65,30),
    "memo" TEXT,
    "imageUrl" TEXT,
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "aiResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietFeedback" (
    "id" TEXT NOT NULL,
    "dietRecordId" TEXT NOT NULL,
    "trainerMembershipId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(65,30),
    "bodyFatPercent" DECIMAL(65,30),
    "skeletalMuscleKg" DECIMAL(65,30),
    "waistCm" DECIMAL(65,30),
    "memo" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DECIMAL(65,30),
    "currentValue" DECIMAL(65,30),
    "unit" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "memberMembershipId" TEXT NOT NULL,
    "trainerMembershipId" TEXT NOT NULL,
    "ptSessionId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "workoutSummary" TEXT,
    "dietGuidance" TEXT,
    "caution" TEXT,
    "nextGoal" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "inputData" JSONB,
    "resultData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "DeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Center_status_idx" ON "Center"("status");

-- CreateIndex
CREATE INDEX "CenterMembership_centerId_role_idx" ON "CenterMembership"("centerId", "role");

-- CreateIndex
CREATE INDEX "CenterMembership_centerId_status_idx" ON "CenterMembership"("centerId", "status");

-- CreateIndex
CREATE INDEX "CenterMembership_assignedTrainerMembershipId_idx" ON "CenterMembership"("assignedTrainerMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterMembership_centerId_userId_key" ON "CenterMembership"("centerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterInvitation_code_key" ON "CenterInvitation"("code");

-- CreateIndex
CREATE INDEX "CenterInvitation_centerId_role_idx" ON "CenterInvitation"("centerId", "role");

-- CreateIndex
CREATE INDEX "CenterInvitation_expiresAt_idx" ON "CenterInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_userId_key" ON "MemberProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_membershipId_key" ON "TrainerProfile"("membershipId");

-- CreateIndex
CREATE INDEX "Equipment_category_idx" ON "Equipment"("category");

-- CreateIndex
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");

-- CreateIndex
CREATE INDEX "Equipment_isActive_idx" ON "Equipment"("isActive");

-- CreateIndex
CREATE INDEX "MemberEquipment_memberId_available_idx" ON "MemberEquipment"("memberId", "available");

-- CreateIndex
CREATE INDEX "MemberEquipment_equipmentId_idx" ON "MemberEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberEquipment_memberId_equipmentId_key" ON "MemberEquipment"("memberId", "equipmentId");

-- CreateIndex
CREATE INDEX "Gym_centerId_isActive_idx" ON "Gym"("centerId", "isActive");

-- CreateIndex
CREATE INDEX "GymEquipment_equipmentId_idx" ON "GymEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GymEquipment_gymId_equipmentId_key" ON "GymEquipment"("gymId", "equipmentId");

-- CreateIndex
CREATE INDEX "Exercise_bodyPart_isActive_idx" ON "Exercise"("bodyPart", "isActive");

-- CreateIndex
CREATE INDEX "Exercise_difficulty_idx" ON "Exercise"("difficulty");

-- CreateIndex
CREATE INDEX "Exercise_movementType_idx" ON "Exercise"("movementType");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "ExerciseEquipment_equipmentId_exerciseId_idx" ON "ExerciseEquipment"("equipmentId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseEquipment_exerciseId_equipmentId_key" ON "ExerciseEquipment"("exerciseId", "equipmentId");

-- CreateIndex
CREATE INDEX "WorkoutAlternative_exerciseId_type_idx" ON "WorkoutAlternative"("exerciseId", "type");

-- CreateIndex
CREATE INDEX "WorkoutAlternative_alternativeExerciseId_idx" ON "WorkoutAlternative"("alternativeExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutAlternative_exerciseId_alternativeExerciseId_key" ON "WorkoutAlternative"("exerciseId", "alternativeExerciseId");

-- CreateIndex
CREATE INDEX "Routine_userId_status_idx" ON "Routine"("userId", "status");

-- CreateIndex
CREATE INDEX "Routine_createdByTrainerMembershipId_idx" ON "Routine"("createdByTrainerMembershipId");

-- CreateIndex
CREATE INDEX "RoutineExercise_routineId_idx" ON "RoutineExercise"("routineId");

-- CreateIndex
CREATE INDEX "RoutineExercise_exerciseId_idx" ON "RoutineExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineExercise_routineId_orderIndex_key" ON "RoutineExercise"("routineId", "orderIndex");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_idx" ON "WorkoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_routineId_idx" ON "WorkoutSession"("routineId");

-- CreateIndex
CREATE INDEX "WorkoutRecord_sessionId_orderIndex_idx" ON "WorkoutRecord"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "WorkoutRecord_exerciseId_createdAt_idx" ON "WorkoutRecord"("exerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutRecord_ptSessionId_idx" ON "WorkoutRecord"("ptSessionId");

-- CreateIndex
CREATE INDEX "WorkoutSet_recordId_idx" ON "WorkoutSet"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSet_recordId_setNumber_key" ON "WorkoutSet"("recordId", "setNumber");

-- CreateIndex
CREATE INDEX "WorkoutFavorite_userId_createdAt_idx" ON "WorkoutFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutFavorite_userId_exerciseId_key" ON "WorkoutFavorite"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "PTProduct_centerId_status_idx" ON "PTProduct"("centerId", "status");

-- CreateIndex
CREATE INDEX "TrainerPTPrice_productId_idx" ON "TrainerPTPrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerPTPrice_trainerMembershipId_productId_key" ON "TrainerPTPrice"("trainerMembershipId", "productId");

-- CreateIndex
CREATE INDEX "PTContract_memberMembershipId_status_idx" ON "PTContract"("memberMembershipId", "status");

-- CreateIndex
CREATE INDEX "PTContract_trainerMembershipId_status_idx" ON "PTContract"("trainerMembershipId", "status");

-- CreateIndex
CREATE INDEX "PTContract_productId_idx" ON "PTContract"("productId");

-- CreateIndex
CREATE INDEX "PTContract_expiresAt_idx" ON "PTContract"("expiresAt");

-- CreateIndex
CREATE INDEX "PTSession_trainerMembershipId_scheduledAt_idx" ON "PTSession"("trainerMembershipId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PTSession_memberMembershipId_scheduledAt_idx" ON "PTSession"("memberMembershipId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PTSession_status_scheduledAt_idx" ON "PTSession"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PTSession_contractId_sessionNumber_key" ON "PTSession"("contractId", "sessionNumber");

-- CreateIndex
CREATE INDEX "DietRecord_userId_date_idx" ON "DietRecord"("userId", "date");

-- CreateIndex
CREATE INDEX "DietRecord_userId_mealType_idx" ON "DietRecord"("userId", "mealType");

-- CreateIndex
CREATE INDEX "DietFeedback_dietRecordId_createdAt_idx" ON "DietFeedback"("dietRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "DietFeedback_trainerMembershipId_createdAt_idx" ON "DietFeedback"("trainerMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "BodyRecord_userId_recordedAt_idx" ON "BodyRecord"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE INDEX "Goal_userId_targetDate_idx" ON "Goal"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "Journal_memberMembershipId_date_idx" ON "Journal"("memberMembershipId", "date");

-- CreateIndex
CREATE INDEX "Journal_trainerMembershipId_date_idx" ON "Journal"("trainerMembershipId", "date");

-- CreateIndex
CREATE INDEX "Journal_ptSessionId_idx" ON "Journal"("ptSessionId");

-- CreateIndex
CREATE INDEX "Journal_status_publishedAt_idx" ON "Journal"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_type_idx" ON "AiAnalysis"("userId", "type");

-- CreateIndex
CREATE INDEX "AiAnalysis_userId_status_idx" ON "AiAnalysis"("userId", "status");

-- CreateIndex
CREATE INDEX "AiAnalysis_createdAt_idx" ON "AiAnalysis"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMembership" ADD CONSTRAINT "CenterMembership_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMembership" ADD CONSTRAINT "CenterMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMembership" ADD CONSTRAINT "CenterMembership_assignedTrainerMembershipId_fkey" FOREIGN KEY ("assignedTrainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInvitation" ADD CONSTRAINT "CenterInvitation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEquipment" ADD CONSTRAINT "MemberEquipment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEquipment" ADD CONSTRAINT "MemberEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipment" ADD CONSTRAINT "ExerciseEquipment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipment" ADD CONSTRAINT "ExerciseEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAlternative" ADD CONSTRAINT "WorkoutAlternative_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutAlternative" ADD CONSTRAINT "WorkoutAlternative_alternativeExerciseId_fkey" FOREIGN KEY ("alternativeExerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_createdByTrainerMembershipId_fkey" FOREIGN KEY ("createdByTrainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutRecord" ADD CONSTRAINT "WorkoutRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutRecord" ADD CONSTRAINT "WorkoutRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutRecord" ADD CONSTRAINT "WorkoutRecord_ptSessionId_fkey" FOREIGN KEY ("ptSessionId") REFERENCES "PTSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "WorkoutRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFavorite" ADD CONSTRAINT "WorkoutFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFavorite" ADD CONSTRAINT "WorkoutFavorite_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTProduct" ADD CONSTRAINT "PTProduct_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerPTPrice" ADD CONSTRAINT "TrainerPTPrice_trainerMembershipId_fkey" FOREIGN KEY ("trainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerPTPrice" ADD CONSTRAINT "TrainerPTPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PTProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_memberMembershipId_fkey" FOREIGN KEY ("memberMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_trainerMembershipId_fkey" FOREIGN KEY ("trainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTContract" ADD CONSTRAINT "PTContract_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PTProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PTContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_memberMembershipId_fkey" FOREIGN KEY ("memberMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTSession" ADD CONSTRAINT "PTSession_trainerMembershipId_fkey" FOREIGN KEY ("trainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietRecord" ADD CONSTRAINT "DietRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietFeedback" ADD CONSTRAINT "DietFeedback_dietRecordId_fkey" FOREIGN KEY ("dietRecordId") REFERENCES "DietRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietFeedback" ADD CONSTRAINT "DietFeedback_trainerMembershipId_fkey" FOREIGN KEY ("trainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyRecord" ADD CONSTRAINT "BodyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_memberMembershipId_fkey" FOREIGN KEY ("memberMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_trainerMembershipId_fkey" FOREIGN KEY ("trainerMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_ptSessionId_fkey" FOREIGN KEY ("ptSessionId") REFERENCES "PTSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
