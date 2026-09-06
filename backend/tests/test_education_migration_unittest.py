from datetime import datetime, timezone

from migrations.education_single_course_v1 import education_content_fields


def test_introduction_is_published_but_not_classified_as_lesson():
    now = datetime.now(timezone.utc)
    fields = education_content_fields("Introducción", now)

    assert fields["status"] == "published"
    assert fields["course_id"] == "fundamentos"
    assert fields["track"] == "Fundamentos"
    assert fields["is_course_intro"] is True


def test_regular_resource_is_published_as_lesson():
    now = datetime.now(timezone.utc)
    fields = education_content_fields("Capítulo 2 Estados Financieros", now)

    assert fields["status"] == "published"
    assert fields["course_id"] == "fundamentos"
    assert fields["is_course_intro"] is False
