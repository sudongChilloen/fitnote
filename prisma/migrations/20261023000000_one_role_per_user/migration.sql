-- 한 계정은 트레이너이거나 회원 중 하나다. 앱에서 막는 것과 별개로 DB 에서도 막는다.
-- 이미 두 프로필을 가진 계정이 있으면 이 트리거는 그 행을 건드리지 않지만, 그 계정은
-- 한쪽을 정리해야 한다.

CREATE FUNCTION "enforce_single_role"() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'TrainerProfile' THEN
    IF EXISTS (SELECT 1 FROM "MemberProfile" WHERE "userId" = NEW."userId") THEN
      RAISE EXCEPTION '회원 프로필이 있는 계정은 트레이너가 될 수 없습니다.' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM "TrainerProfile" WHERE "userId" = NEW."userId") THEN
      RAISE EXCEPTION '트레이너 프로필이 있는 계정은 회원이 될 수 없습니다.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TrainerProfile_single_role"
  BEFORE INSERT ON "TrainerProfile"
  FOR EACH ROW EXECUTE FUNCTION "enforce_single_role"();

CREATE TRIGGER "MemberProfile_single_role"
  BEFORE INSERT ON "MemberProfile"
  FOR EACH ROW EXECUTE FUNCTION "enforce_single_role"();
