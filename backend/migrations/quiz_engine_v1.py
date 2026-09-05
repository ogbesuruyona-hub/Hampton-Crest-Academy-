"""Create Quiz Engine indexes and seed the first Fundamentos evaluation.

This migration is intentionally idempotent and is invoked by the existing runtime
bootstrap. Existing administrator-created quizzes are never overwritten.
"""

from __future__ import annotations

import hashlib

from pymongo.errors import DuplicateKeyError


def _seed_id(label: str) -> str:
    return hashlib.md5(f"hampton-crest-quiz-v1:{label}".encode("utf-8")).hexdigest()


DEMO_QUESTIONS = [
    {
        "question_text": "¿Qué representa principalmente una acción ordinaria?",
        "difficulty": "fundamental",
        "explanation": "Una acción representa una participación en la propiedad de una empresa y expone al inversionista a sus resultados y riesgos.",
        "options": [
            ("Una participación en la propiedad de una empresa", True),
            ("Un préstamo garantizado al gobierno", False),
            ("Un depósito bancario con tasa fija", False),
            ("Un contrato que elimina el riesgo de mercado", False),
        ],
    },
    {
        "question_text": "¿Cuál describe mejor la diferencia entre una acción y un bono?",
        "difficulty": "fundamental",
        "explanation": "La acción representa propiedad; el bono representa deuda y normalmente establece pagos de intereses y devolución de principal.",
        "options": [
            ("La acción es propiedad y el bono es una obligación de deuda", True),
            ("La acción siempre paga intereses y el bono nunca lo hace", False),
            ("El bono representa propiedad y la acción representa deuda", False),
            ("No existe diferencia económica entre ambos", False),
        ],
    },
    {
        "question_text": "¿Cuál es el objetivo principal de diversificar una cartera?",
        "difficulty": "fundamental",
        "explanation": "Diversificar distribuye la exposición entre activos o fuentes de riesgo; reduce el impacto de un resultado adverso individual, aunque no elimina todo riesgo.",
        "options": [
            ("Reducir la dependencia de un solo activo o riesgo", True),
            ("Garantizar ganancias en cualquier mercado", False),
            ("Eliminar por completo la volatilidad", False),
            ("Concentrar el capital en la mejor idea disponible", False),
        ],
    },
    {
        "question_text": "En términos generales, ¿qué relación suele existir entre riesgo esperado y retorno esperado?",
        "difficulty": "intermediate",
        "explanation": "Los inversionistas suelen exigir mayor retorno esperado por asumir mayor incertidumbre. Un retorno esperado mayor no garantiza un retorno realizado mayor.",
        "options": [
            ("Mayor riesgo suele requerir mayor retorno esperado", True),
            ("Mayor riesgo garantiza un mayor retorno realizado", False),
            ("Menor riesgo siempre produce pérdidas", False),
            ("Riesgo y retorno no guardan relación", False),
        ],
    },
    {
        "question_text": "¿Qué compara el múltiplo precio/utilidad (P/E)?",
        "difficulty": "intermediate",
        "explanation": "El P/E relaciona el precio de mercado por acción con la utilidad por acción. Debe interpretarse junto con crecimiento, calidad y contexto sectorial.",
        "options": [
            ("El precio por acción con la utilidad por acción", True),
            ("Los dividendos con la deuda total", False),
            ("Los ingresos con el efectivo disponible", False),
            ("La capitalización con el valor contable total", False),
        ],
    },
    {
        "question_text": "¿Qué es un dividendo?",
        "difficulty": "fundamental",
        "explanation": "Un dividendo es una distribución que una empresa decide hacer a sus accionistas; puede reducirse o suspenderse y no está garantizado.",
        "options": [
            ("Una distribución de valor de la empresa a sus accionistas", True),
            ("Un interés obligatorio pagado por toda acción", False),
            ("Una comisión cobrada por la bolsa", False),
            ("Una garantía de que el precio subirá", False),
        ],
    },
    {
        "question_text": "¿Cómo se calcula normalmente la capitalización de mercado de una empresa?",
        "difficulty": "intermediate",
        "explanation": "La capitalización de mercado es el precio de una acción multiplicado por el número de acciones en circulación.",
        "options": [
            ("Precio por acción × acciones en circulación", True),
            ("Ingresos anuales × margen bruto", False),
            ("Activos totales − pasivos corrientes", False),
            ("Dividendo por acción × utilidad neta", False),
        ],
    },
    {
        "question_text": "¿Qué mide la volatilidad de un activo?",
        "difficulty": "intermediate",
        "explanation": "La volatilidad describe cuánto y con qué frecuencia fluctúan los retornos o el precio; no resume por sí sola todos los tipos de riesgo.",
        "options": [
            ("La magnitud de las fluctuaciones de sus retornos o precio", True),
            ("La probabilidad exacta de quiebra", False),
            ("El crecimiento garantizado de sus utilidades", False),
            ("La cantidad de dividendos futuros", False),
        ],
    },
    {
        "question_text": "¿Qué caracteriza mejor una perspectiva de inversión a largo plazo?",
        "difficulty": "application",
        "explanation": "El largo plazo enfatiza fundamentales, horizonte y disciplina frente al ruido de corto plazo, sin ignorar cambios materiales en la tesis.",
        "options": [
            ("Evaluar fundamentales y mantener disciplina durante el horizonte definido", True),
            ("Ignorar para siempre cualquier cambio en la empresa", False),
            ("Comprar únicamente después de una subida rápida", False),
            ("Predecir cada movimiento diario del mercado", False),
        ],
    },
    {
        "question_text": "Dos empresas tienen utilidades similares, pero una posee deuda elevada y flujos muy inestables. ¿Qué conclusión es más prudente?",
        "difficulty": "application",
        "explanation": "Utilidades similares no implican el mismo riesgo ni el mismo valor. La deuda y la estabilidad de flujos afectan resiliencia y valoración, por lo que requieren análisis adicional.",
        "options": [
            ("La empresa endeudada puede requerir mayor margen de seguridad", True),
            ("Ambas deben valer exactamente lo mismo", False),
            ("La deuda elevada siempre aumenta el valor", False),
            ("La estabilidad de los flujos no afecta el análisis", False),
        ],
    },
]


async def ensure_quiz_engine(db, now_utc) -> None:
    await db.quizzes.create_index("course_id", unique=True)
    await db.quiz_questions.create_index([("quiz_id", 1), ("position", 1)], unique=True)
    await db.quiz_options.create_index([("question_id", 1), ("position", 1)], unique=True)
    await db.quiz_attempts.create_index(
        [("user_id", 1), ("quiz_id", 1), ("attempt_number", 1)],
        unique=True,
    )
    await db.quiz_attempts.create_index(
        [("user_id", 1), ("quiz_id", 1), ("status", 1)],
        unique=True,
        partialFilterExpression={"status": "in_progress"},
    )
    await db.quiz_attempt_answers.create_index(
        [("attempt_id", 1), ("question_id", 1)],
        unique=True,
    )
    await db.quiz_attempt_answers.create_index([("quiz_id", 1), ("question_id", 1), ("is_correct", 1)])
    await db.course_progress.create_index([("user_id", 1), ("course_id", 1)], unique=True)

    if await db.quizzes.find_one({"course_id": "fundamentos"}, {"_id": 1}):
        return

    now = now_utc()
    quiz_id = _seed_id("fundamentos")
    quiz = {
        "_id": quiz_id,
        "seed_key": "fundamentos-v1",
        "course_id": "fundamentos",
        "course_title": "Fundamentos",
        "title": "Evaluación de Fundamentos de Inversión",
        "description": "Comprueba tu comprensión de acciones, bonos, diversificación, riesgo y valoración básica.",
        "passing_score": 80,
        "is_active": True,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db.quizzes.insert_one(quiz)
    except DuplicateKeyError:
        return

    for question_position, question_data in enumerate(DEMO_QUESTIONS):
        question_id = _seed_id(f"fundamentos:q:{question_position}")
        await db.quiz_questions.insert_one(
            {
                "_id": question_id,
                "quiz_id": quiz_id,
                "question_text": question_data["question_text"],
                "explanation": question_data["explanation"],
                "difficulty": question_data["difficulty"],
                "position": question_position,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        )
        for option_position, (option_text, is_correct) in enumerate(question_data["options"]):
            await db.quiz_options.insert_one(
                {
                    "_id": _seed_id(f"fundamentos:q:{question_position}:o:{option_position}"),
                    "question_id": question_id,
                    "option_text": option_text,
                    "position": option_position,
                    "is_correct": is_correct,
                    "created_at": now,
                    "updated_at": now,
                }
            )
