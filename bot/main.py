import asyncio
import os
from dataclasses import dataclass

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup, ReplyKeyboardRemove


@dataclass(frozen=True)
class Config:
    bot_token: str
    api_url: str
    public_crm_url: str

    @classmethod
    def from_env(cls) -> "Config":
        token = os.getenv("BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError("BOT_TOKEN is required")
        return cls(
            bot_token=token,
            api_url=os.getenv("API_URL", "http://api:8000").rstrip("/"),
            public_crm_url=os.getenv("PUBLIC_CRM_URL", "http://localhost:8000").rstrip("/"),
        )


class LeadForm(StatesGroup):
    name = State()
    contact = State()
    request = State()


def contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Отправить мой телефон", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def build_router(config: Config) -> Router:
    router = Router()

    async def begin(message: Message, state: FSMContext) -> None:
        await state.clear()
        await state.set_state(LeadForm.name)
        await message.answer(
            "Привет! Я соберу заявку для агентства. Как к вам обращаться?",
            reply_markup=ReplyKeyboardRemove(),
        )

    @router.message(CommandStart())
    async def start(message: Message, state: FSMContext) -> None:
        await begin(message, state)

    @router.message(Command("new"))
    async def new_lead(message: Message, state: FSMContext) -> None:
        await begin(message, state)

    @router.message(LeadForm.name, F.text)
    async def capture_name(message: Message, state: FSMContext) -> None:
        name = (message.text or "").strip()
        if len(name) < 2:
            await message.answer("Имя слишком короткое. Напишите хотя бы 2 символа.")
            return
        await state.update_data(name=name[:100])
        await state.set_state(LeadForm.contact)
        await message.answer(
            "Как с вами связаться? Напишите телефон, email или Telegram, либо отправьте номер кнопкой ниже.",
            reply_markup=contact_keyboard(),
        )

    @router.message(LeadForm.contact, F.contact)
    async def capture_contact_object(message: Message, state: FSMContext) -> None:
        await state.update_data(contact=message.contact.phone_number)
        await state.set_state(LeadForm.request)
        await message.answer("Коротко опишите запрос.", reply_markup=ReplyKeyboardRemove())

    @router.message(LeadForm.contact, F.text)
    async def capture_contact_text(message: Message, state: FSMContext) -> None:
        contact = (message.text or "").strip()
        if len(contact) < 3:
            await message.answer("Контакт слишком короткий. Попробуйте ещё раз.")
            return
        await state.update_data(contact=contact[:200])
        await state.set_state(LeadForm.request)
        await message.answer("Коротко опишите запрос.", reply_markup=ReplyKeyboardRemove())

    @router.message(LeadForm.request, F.text)
    async def capture_request(message: Message, state: FSMContext) -> None:
        request_text = (message.text or "").strip()
        if len(request_text) < 3:
            await message.answer("Добавьте немного деталей к запросу.")
            return
        data = await state.get_data()
        user = message.from_user
        payload = {
            "name": data["name"],
            "contact": data["contact"],
            "request": request_text[:4000],
            "source": "telegram_bot",
            "external_id": f"telegram:{user.id}:{message.message_id}" if user else None,
            "telegram_user_id": str(user.id) if user else None,
            "telegram_username": user.username if user else None,
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(f"{config.api_url}/api/leads", json=payload)
                response.raise_for_status()
                lead = response.json()
        except (httpx.HTTPError, ValueError):
            await message.answer("Не удалось сохранить заявку. Попробуйте ещё раз через минуту.")
            return

        await state.clear()
        short_id = lead["id"].split("-")[0]
        await message.answer(
            "Готово — заявка уже в CRM.\n"
            f"ID: <code>{short_id}</code>\n"
            "Чтобы создать ещё одну, отправьте /new."
        )

    @router.message()
    async def fallback(message: Message, state: FSMContext) -> None:
        if await state.get_state() is None:
            await begin(message, state)

    return router


async def main() -> None:
    config = Config.from_env()
    bot = Bot(config.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(build_router(config))
    await bot.delete_webhook(drop_pending_updates=True)
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
