'use client';

import { BRAND_NAME } from '@/lib/brand';

type Props = { type: 'terms' | 'privacy'; onClose: () => void };

export default function LegalModal({ type, onClose }: Props) {
  return (
    <div className="app-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="app-modal" style={{ maxWidth: 640, textAlign: 'left' }}>
        <div className="app-row">
          <h3 style={{ margin: 0 }}>{type === 'terms' ? '이용약관' : '개인정보 처리방침'}</h3>
          <span className="app-spacer" />
          <button className="app-btn app-btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <p className="app-muted" style={{ fontSize: '0.8rem' }}>
          ⚠️ 표준 템플릿입니다. 정식 출시 전 사업자 정보·연락처를 채우고 법률 검토를 받으세요.
        </p>
        {type === 'terms' ? <Terms /> : <Privacy />}
      </div>
    </div>
  );
}

function Terms() {
  return (
    <div style={{ lineHeight: 1.7 }}>
      <h4>제1조 (목적)</h4>
      <p className="app-muted">본 약관은 {BRAND_NAME}(이하 “서비스”)의 이용 조건·절차와 회원·서비스의 권리·의무를 규정합니다.</p>
      <h4>제2조 (서비스 내용)</h4>
      <p className="app-muted">친구 간 일정 공유, 그룹/모임의 공통 가능 시간 찾기, 연차 계획 등 캘린더 기반 기능을 제공합니다.</p>
      <h4>제3조 (계정)</h4>
      <p className="app-muted">회원은 구글 계정으로 로그인하며, 계정 관리 책임은 회원에게 있습니다.</p>
      <h4>제4조 (금지행위)</h4>
      <p className="app-muted">타인 정보 도용, 서비스 운영 방해, 불법적 이용을 금합니다.</p>
      <h4>제5조 (책임의 한계)</h4>
      <p className="app-muted">서비스는 무료로 제공되며, 천재지변·이용자 귀책 등으로 인한 손해에 대해 책임지지 않습니다.</p>
      <h4>제6조 (약관 변경)</h4>
      <p className="app-muted">약관은 사전 공지 후 변경될 수 있습니다.</p>
    </div>
  );
}

function Privacy() {
  return (
    <div style={{ lineHeight: 1.7 }}>
      <h4>1. 수집 항목</h4>
      <p className="app-muted">
        구글 로그인 시 이메일·이름·프로필 사진·구글 식별자(sub)를 수집합니다. 이용 중 작성한 일정·그룹·모임 정보가 저장됩니다.
      </p>
      <h4>2. 이용 목적</h4>
      <p className="app-muted">로그인 인증, 일정 공유·공개범위 제어, 그룹·모임 기능 제공.</p>
      <h4>3. 보관 및 파기</h4>
      <p className="app-muted">회원 탈퇴 또는 수집 목적 달성 시 지체 없이 파기합니다.</p>
      <h4>4. 제3자 제공</h4>
      <p className="app-muted">법령에 의한 경우를 제외하고 외부에 제공하지 않습니다.</p>
      <h4>5. 이용자 권리</h4>
      <p className="app-muted">이용자는 본인 정보의 열람·정정·삭제를 요청할 수 있습니다.</p>
    </div>
  );
}
