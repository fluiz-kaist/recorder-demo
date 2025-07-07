import React from "react";
import styles from "@/styles/Footer.module.css";

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* 도움말 링크 */}
        <div className={styles.helpSection}>
          <div className={styles.helpItem}>
            <div className={styles.helpIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
            </div>
            <span className={styles.helpText}>도움말</span>
          </div>
          
          <div className={styles.helpItem}>
            <div className={styles.helpIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <span className={styles.helpText}>문의하기</span>
          </div>
        </div>

        {/* 구분선 */}
        <div className={styles.divider}></div>

        {/* 저작권 정보 */}
        <div className={styles.copyright}>
          <p className={styles.copyrightText}>
            © 2024 음성수집 서비스. 모든 권리 보유.
          </p>
          <p className={styles.versionText}>
            버전 1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;